import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enqueueBrevoEvent } from '@/lib/brevo/events'

// Nudge de reativação: cadastro concluído mas SEM certificado A1.
//
// Motivação (investigação 2026-08): 100% dos cadastros ME reais (Kailaine,
// Jean, EXPERTS) travaram no MESMO ponto — o upload do certificado A1. Nenhum
// subiu cert, nenhum emitiu. É o gargalo #1 do funil pós-cadastro. Este job
// varre a coorte "empapada no cert" e emite o evento Brevo `cert_pending`, que
// dispara a automação de e-mail "falta 1 passo: seu certificado".
//
// Arquitetura: NÃO envia e-mail daqui. Só emite o evento pro Brevo (mesma
// esteira de `user_signup`/`cert_uploaded`). Quem manda o e-mail é a automação
// do Brevo — habilitá-la é passo de configuração externa (ver docs).
//
// Idempotência: 1 nudge por empresa via UNIQUE(email_dispatch_log.user_id,
// campaign_key='reativacao_cert'). Reenvio é no-op — insere a marca ANTES de
// emitir o evento; conflito (23505) = já nudgeado, pula.
//
// Coorte:
//   - cert_secret_arn e cert_valid_until NULL (nunca subiu cert — cert_uploaded_at
//     não é preenchido pelo upload, não serve de critério)
//   - user_id IS NOT NULL        (conta real linkada — exclui seeds de QA)
//   - created_at entre 1 e 60 dias atrás (dá 1 dia antes de cutucar; não cutuca lead fóssil)
//   - unsubscribed_urgency != true (respeita opt-out de e-mail de ciclo de vida)
//
// Proteção: header Authorization: Bearer <CRON_SECRET> em prod (mesmo padrão
// de /api/cron/brevo-queue).

const CAMPAIGN_KEY = 'reativacao_cert'
const MIN_IDADE_DIAS = 1
const MAX_IDADE_DIAS = 60
const BATCH = 200

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev/preview sem secret — aberto
  return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`
}

interface EmpresaRow {
  id: string
  user_id: string
  email: string
  razao_social: string | null
  tipo: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const sb = service()
  const now = Date.now()
  const maxCreated = new Date(now - MIN_IDADE_DIAS * 86_400_000).toISOString()
  const minCreated = new Date(now - MAX_IDADE_DIAS * 86_400_000).toISOString()

  const { data: rows, error } = await sb
    .from('empresas')
    .select('id, user_id, email, razao_social, tipo, created_at')
    .is('cert_secret_arn', null)
    .is('cert_valid_until', null)
    .not('user_id', 'is', null)
    .lte('created_at', maxCreated)
    .gte('created_at', minCreated)
    .neq('unsubscribed_urgency', true)
    .order('created_at', { ascending: true })
    .limit(BATCH)
    .returns<EmpresaRow[]>()

  if (error) {
    console.error('[cron/reativacao-cert] select failed', error)
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  const cohort = rows ?? []
  let enqueued = 0
  let skipped = 0
  let failed = 0

  for (const e of cohort) {
    const diasSemCert = Math.floor((now - new Date(e.created_at).getTime()) / 86_400_000)

    // Marca ANTES de emitir — a UNIQUE(user_id, campaign_key) garante 1x só.
    // Se já existe (23505), significa que já nudgeamos essa empresa: pula.
    const { error: logErr } = await sb.from('email_dispatch_log').insert({
      user_id: e.user_id,
      email: e.email,
      campaign_key: CAMPAIGN_KEY,
      metadata: { dias_sem_cert: diasSemCert, tipo: e.tipo },
    })

    if (logErr) {
      if (logErr.code === '23505') { skipped++; continue } // já nudgeado
      console.error('[cron/reativacao-cert] log insert failed', { email: e.email, err: logErr.message })
      failed++
      continue
    }

    const { ok } = await enqueueBrevoEvent({
      eventName: 'cert_pending',
      email: e.email,
      properties: {
        user_id: e.user_id,
        razao_social: e.razao_social ?? '',
        tipo: e.tipo ?? '',
        dias_sem_cert: diasSemCert,
      },
      // Idempotência do lado da fila também (email+evento por dia).
      eventId: `${e.email}:cert_pending:${CAMPAIGN_KEY}`,
    })

    if (ok) {
      enqueued++
    } else {
      // Evento não enfileirou — desfaz a marca pra tentar de novo no próximo tick.
      failed++
      await sb.from('email_dispatch_log')
        .delete()
        .eq('user_id', e.user_id)
        .eq('campaign_key', CAMPAIGN_KEY)
    }
  }

  return NextResponse.json({ cohort: cohort.length, enqueued, skipped, failed })
}
