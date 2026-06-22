/**
 * PATCH /admin/api/errors/[id] — marca resolved/reopen.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'

interface Ctx { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/errors')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let body: { resolved?: boolean }
  try { body = await request.json() } catch { body = {} }
  const resolved = !!body.resolved

  const admin = createAdminClient()
  const { error } = await admin
    .from('error_log')
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? user.id : null,
    })
    .eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
