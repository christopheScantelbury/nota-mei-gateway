/**
 * POST /admin/api/emails/reenviar — devolve e-mails à fila (email_outbox).
 * Body: { ids: string[] }. A fila da API (Go) pega em até 1 minuto, com o
 * contador de tentativas zerado.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/emails')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let body: { ids?: unknown }
  try { body = await request.json() } catch { body = {} }
  const ids = Array.isArray(body.ids) ? body.ids.filter((i): i is string => typeof i === 'string' && UUID_RE.test(i)) : []
  if (ids.length === 0 || ids.length > 500) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'informe de 1 a 500 ids' }, { status: 422 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('email_outbox')
    .update({ status: 'pendente', tentativas: 0, proxima_tentativa_em: new Date().toISOString(), ultimo_erro: null })
    .in('id', ids)
    .select('id')
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, reenfileirados: data?.length ?? 0 })
}
