/**
 * PATCH /admin/api/feedback/[id] — atualiza status + notes_admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

const VALID_STATUS = ['open', 'triaging', 'resolved', 'wontfix'] as const

interface Ctx { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/feedback')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  let body: { status?: string; notes_admin?: string }
  try { body = await request.json() } catch { body = {} }

  const status = VALID_STATUS.includes(body.status as typeof VALID_STATUS[number])
    ? (body.status as typeof VALID_STATUS[number])
    : null
  if (!status) {
    return NextResponse.json({ error: 'VALIDATION', message: 'status inválido' }, { status: 422 })
  }

  const admin = createAdminClient()
  const patch: Record<string, unknown> = { status }
  if (body.notes_admin !== undefined) patch.notes_admin = body.notes_admin || null
  if (status === 'resolved') {
    patch.resolved_at = new Date().toISOString()
    patch.resolved_by = user.id
  } else if (status === 'open') {
    patch.resolved_at = null
    patch.resolved_by = null
  }

  const { error } = await admin
    .from('customer_feedback')
    .update(patch)
    .eq('id', params.id)
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  await logAdminAction({
    action: status === 'resolved' ? 'page_access' : 'page_access',
    targetKind: 'page',
    targetId: `/admin/feedback/${params.id}`,
    after: { status, notes_admin: patch.notes_admin },
  })

  return NextResponse.json({ ok: true })
}
