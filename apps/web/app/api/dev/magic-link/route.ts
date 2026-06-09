/**
 * POST /api/dev/magic-link — gera magic link admin pra QA / debugging.
 *
 * GATED por `DEV_ADMIN_TOKEN` em env. Header obrigatório:
 *   Authorization: Bearer $DEV_ADMIN_TOKEN
 *
 * Defesa em profundidade:
 *   1. Se DEV_ADMIN_TOKEN não está setado → 503 (rota desabilitada)
 *   2. Token comparado com timingSafeEqual (anti timing-attack)
 *   3. Email validado por regex
 *   4. Não retorna info se user existe ou não (consistente com /login)
 *   5. Em prod só funciona se DEV_ADMIN_TOKEN tem ≥32 chars (anti força bruta)
 *
 * Uso:
 *   curl -X POST https://www.emitirnotafacil.com.br/api/dev/magic-link \
 *     -H "Authorization: Bearer $DEV_ADMIN_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"teste-empresa@notafacil.com"}'
 *
 * Resposta:
 *   { "action_link": "https://...supabase.co/auth/v1/verify?token=..." }
 *
 * Abrir o action_link em janela anônima → sessão estabelecida + redirect /home.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function denyResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const adminToken = process.env.DEV_ADMIN_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 1. Rota desabilitada se env não setado
  if (!adminToken) {
    return denyResponse(503, 'magic_link_disabled')
  }

  // 2. Anti-força bruta: em produção, exige token forte (≥32 chars)
  if (process.env.APP_ENV === 'production' && adminToken.length < 32) {
    return denyResponse(503, 'magic_link_disabled')
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return denyResponse(503, 'supabase_not_configured')
  }

  // 3. Autenticação por header (timing-safe)
  const auth = req.headers.get('authorization') ?? ''
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  // timingSafeEqual exige buffers do mesmo tamanho — padronizamos pelo maior
  // pra não vazar comprimento via timing.
  const a = Buffer.from(presented.padEnd(adminToken.length, '\0'))
  const b = Buffer.from(adminToken.padEnd(presented.length, '\0'))
  if (a.length !== b.length || !timingSafeEqual(a, b) || presented.length !== adminToken.length) {
    return denyResponse(401, 'unauthorized')
  }

  // 4. Body
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return denyResponse(400, 'invalid_json')
  }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return denyResponse(400, 'invalid_email')
  }

  // 5. Gerar link via Supabase admin API
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ⚠️ Tem que bater EXATAMENTE com Supabase `site_url` (config Auth) —
  // atualmente `https://www.emitirnotafacil.com.br`. O apex (sem www) tem
  // SSL/routing intermitente no Vercel, então não confiável como fallback.
  const APP_ORIGIN = 'https://www.emitirnotafacil.com.br'

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_ORIGIN}/auth/callback?next=/home` },
  })

  if (error) {
    // Não revela detalhes do erro (mantém genérico).
    return denyResponse(500, 'generate_failed')
  }

  // ⚠️ Bug fix 2026-06-08: o `action_link` original do Supabase aponta pra
  //   https://<proj>.supabase.co/auth/v1/verify?token=<HASH>&type=magiclink&redirect_to=<APP>
  // que ao ser seguido, redireciona pro APP com token NO HASH (#access_token=...).
  // Hash não chega no server, então o callback falhava com `auth_callback_failed`.
  //
  // Solução: extraímos `token` (o token_hash) e construímos URL direto pra
  // `/auth/callback?token_hash=...&type=magiclink&next=/home`. O callback agora
  // aceita esse formato via `verifyOtp({type, token_hash})`.
  const originalLink = data?.properties?.action_link ?? null
  let actionLink: string | null = null
  if (originalLink) {
    try {
      const parsed = new URL(originalLink)
      const tokenHash = parsed.searchParams.get('token')
      const linkType  = parsed.searchParams.get('type') ?? 'magiclink'
      if (tokenHash) {
        const direct = new URL(`${APP_ORIGIN}/auth/callback`)
        direct.searchParams.set('token_hash', tokenHash)
        direct.searchParams.set('type', linkType)
        direct.searchParams.set('next', '/home')
        actionLink = direct.toString()
      } else {
        actionLink = originalLink  // fallback se formato mudar
      }
    } catch {
      actionLink = originalLink
    }
  }

  return NextResponse.json({
    action_link: actionLink,
    email,
  })
}
