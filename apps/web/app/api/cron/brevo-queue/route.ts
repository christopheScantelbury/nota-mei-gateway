import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { trackEvent } from '@/lib/brevo/client'

// Worker periódico (Vercel Cron) que consome `brevo_event_queue`.
//
// Spec: HIST-6.1.
// Roda a cada minuto via vercel.json crons. Pega até 50 eventos pending/failed
// com next_retry_at <= now, envia ao Brevo. Sucesso → 'sent'. Falha → status
// 'failed' com retry exponencial. Após 5 retries vira 'dead' e dispara alerta.
//
// Proteção: header Authorization: Bearer <CRON_SECRET> requerido em prod.

const MAX_RETRIES = 5
const BACKOFF_BASE_MS = 1_000

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // segundos

function service() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev/preview sem secret — abertos
  const got = req.headers.get('authorization') ?? ''
  return got === `Bearer ${secret}`
}

interface QueueRow {
  id: number
  event_id: string
  event_name: string
  email: string
  properties: Record<string, unknown> | null
  occurred_at: string
  retry_count: number
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const sb = service()
  const now = new Date().toISOString()

  // Pega batch elegível pra envio
  const { data: rows, error } = await sb
    .from('brevo_event_queue')
    .select('id, event_id, event_name, email, properties, occurred_at, retry_count')
    .in('status', ['pending', 'failed'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .lt('retry_count', MAX_RETRIES)
    .order('occurred_at', { ascending: true })
    .limit(50)
    .returns<QueueRow[]>()

  if (error) {
    console.error('[cron/brevo-queue] select failed', error)
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  const batch = rows ?? []
  let okCount = 0
  let failCount = 0

  for (const ev of batch) {
    const result = await trackEvent({
      event_name: ev.event_name,
      identifiers: { email_id: ev.email },
      contact_properties: ev.properties ?? undefined,
      event_properties: { occurred_at: ev.occurred_at },
    })

    if (result.ok) {
      okCount++
      await sb
        .from('brevo_event_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', ev.id)
    } else {
      failCount++
      const nextRetryMs = BACKOFF_BASE_MS * Math.pow(2, ev.retry_count)
      const newStatus = ev.retry_count + 1 >= MAX_RETRIES ? 'dead' : 'failed'
      await sb
        .from('brevo_event_queue')
        .update({
          status: newStatus,
          retry_count: ev.retry_count + 1,
          last_error: result.message ?? `status=${result.status}`,
          next_retry_at: new Date(Date.now() + nextRetryMs).toISOString(),
        })
        .eq('id', ev.id)

      if (newStatus === 'dead') {
        console.error('[cron/brevo-queue] dead letter', {
          event_id: ev.event_id, email: ev.email, last_error: result.message,
        })
      }
    }
  }

  return NextResponse.json({ processed: batch.length, ok: okCount, fail: failCount })
}
