/**
 * PATCH /admin/api/permissoes/[userId]/ativo — toggle ativo do admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, invalidateAdminCache } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

interface Ctx { params: { userId: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  if (params.userId === user.id) {
    return NextResponse.json(
      { error: 'INVALID', message: 'Não pode desativar a si mesmo' },
      { status: 422 },
    )
  }

  let body: { ativo?: boolean }
  try { body = await request.json() } catch { body = {} }
  const ativo = body.ativo === true

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('admin_users')
    .select('ativo, role')
    .eq('user_id', params.userId)
    .single<{ ativo: boolean; role: string }>()

  const { error } = await admin
    .from('admin_users')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('user_id', params.userId)

  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
  }

  invalidateAdminCache(params.userId)
  await logAdminAction({
    action: ativo ? 'user_promote' : 'user_deactivate',
    targetKind: 'admin_user',
    targetId: params.userId,
    before,
    after: { ativo },
  })

  return NextResponse.json({ ok: true })
}
