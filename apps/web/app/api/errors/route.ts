/**
 * POST /api/errors — registra error_log com dedupe via fingerprint (#245).
 *
 * Não exige auth (errors podem vir de páginas públicas/login). Usa
 * service role pra inserir respeitando RLS.
 *
 * Anti-abuse: rate-limit naive por IP (in-memory Map). 50 req/min.
 * Pra MVP — quando virar problema real, migrar pra Redis ou trocar
 * por Sentry SDK.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_SOURCE = ['web-client', 'web-server', 'api-go', 'worker-go']
const VALID_LEVEL = ['error', 'warning', 'info']

const RATE_LIMIT_MAX = 50
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimitOK(ip: string): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false
  bucket.count++
  return true
}

function fingerprintOf(message: string, stack: string | undefined): string {
  // Topo do stack tende a identificar o local. Pegamos message + 1ª linha do stack.
  const topStack = (stack ?? '').split('\n')[0] ?? ''
  return createHash('sha256').update(`${message}|${topStack}`).digest('hex').slice(0, 32)
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  if (!rateLimitOK(ip)) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  }

  let body: {
    message?: string
    stack?: string
    source?: string
    url?: string
    metadata?: Record<string, unknown>
    level?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'VALIDATION', message: 'message obrigatório' }, { status: 422 })
  }
  const source = VALID_SOURCE.includes(body.source ?? '') ? body.source! : 'web-client'
  const level = VALID_LEVEL.includes(body.level ?? '') ? body.level! : 'error'

  // user_id opcional — best-effort (errors podem vir de páginas não autenticadas)
  let userId: string | null = null
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) userId = user.id
  } catch {
    // ignore
  }

  const fingerprint = fingerprintOf(body.message, body.stack)
  const userAgent = request.headers.get('user-agent')

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('error_log_upsert' as never, {
    p_fingerprint: fingerprint,
    p_level: level,
    p_source: source,
    p_message: body.message.slice(0, 2000),
    p_stack: body.stack?.slice(0, 4000) ?? null,
    p_url: body.url ?? null,
    p_user_id: userId,
    p_user_agent: userAgent,
    p_metadata: body.metadata ?? null,
  } as never)

  if (error) {
    // Não joga 500 (cliente vai tentar de novo e loop). Loga e retorna 202.
    console.warn('[errors] upsert failed', error.message)
    return NextResponse.json({ ok: false }, { status: 202 })
  }

  return NextResponse.json({ ok: true, id: data })
}
