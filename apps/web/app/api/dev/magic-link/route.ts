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

  // IMPORTANTE: sem redirectTo, Supabase manda pra site URL raiz com tokens
  // no fragment (#access_token=...). Frontend na raiz não captura — link
  // parece "quebrado" pro user. Apontando pra /auth/callback ativa PKCE
  // (code no query string), e o handler troca code por session + redirect
  // pra /home.
  //
  // ⚠️ Tem que ser SEM `www.` — Supabase tem `site_url` apex configurado
  // (https://emitirnotafacil.com.br) e ignora silenciosamente redirectTo
  // com subdomínio www, mesmo que esteja na allow list. O CDN da Vercel
  // serve o apex direto sem redirect, então o /auth/callback responde.
  const callbackURL = 'https://emitirnotafacil.com.br/auth/callback?next=/home'

  const { data, error } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: callbackURL },
  })

  if (error) {
    // Não revela detalhes do erro (mantém genérico).
    return denyResponse(500, 'generate_failed')
  }

  return NextResponse.json({
    action_link: data?.properties?.action_link ?? null,
    email,
  })
}
