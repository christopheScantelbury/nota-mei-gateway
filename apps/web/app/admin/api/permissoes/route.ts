/**
 * GET  /admin/api/permissoes — lista admins + grants (super_admin only).
 *                              Usado pelo client após mutations pra refetch
 *                              sem reload (BUG-001 QA 2026-06-17).
 * POST /admin/api/permissoes — cria novo admin (super_admin only).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, invalidateAdminCache } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: admins }, { data: grants }, { data: usersListData }] = await Promise.all([
    admin
      .from('admin_users')
      .select('user_id, role, ativo, notes, created_at')
      .order('created_at', { ascending: false }),
    admin.from('admin_page_grants').select('user_id, page_path, can_read, can_write'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailMap = new Map<string, string>()
  for (const u of usersListData?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email)
  }
  const grantsByUser = new Map<string, Array<{ page_path: string; can_read: boolean; can_write: boolean }>>()
  for (const g of grants ?? []) {
    if (!grantsByUser.has(g.user_id)) grantsByUser.set(g.user_id, [])
    grantsByUser.get(g.user_id)!.push({ page_path: g.page_path, can_read: g.can_read, can_write: g.can_write })
  }

  const rows = (admins ?? []).map((a) => ({
    ...a,
    email: emailMap.get(a.user_id) ?? '—',
    grants: grantsByUser.get(a.user_id) ?? [],
  }))

  return NextResponse.json({ admins: rows })
}

export async function POST(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isSuperAdmin) {
    return NextResponse.json({ error: 'FORBIDDEN', message: 'Apenas super_admin' }, { status: 403 })
  }

  let body: { email?: string; role?: 'admin' | 'super_admin'; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const role = body.role === 'super_admin' ? 'super_admin' : 'admin'
  const notes = body.notes?.trim() || null

  if (!email) {
    return NextResponse.json({ error: 'VALIDATION', message: 'Email obrigatório' }, { status: 422 })
  }

  // Resolve user_id via auth.admin.listUsers
  const admin = createAdminClient()
  const { data: usersListData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const targetUser = usersListData?.users.find((u) => u.email?.toLowerCase() === email)
  if (!targetUser) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: `Email "${email}" não está cadastrado em auth.users` },
      { status: 404 },
    )
  }

  const { error: upsertErr } = await admin
    .from('admin_users')
    .upsert({
      user_id: targetUser.id,
      role,
      ativo: true,
      notes,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
  if (upsertErr) {
    return NextResponse.json({ error: 'DB_ERROR', message: upsertErr.message }, { status: 500 })
  }

  invalidateAdminCache(targetUser.id)

  await logAdminAction({
    action: 'user_promote',
    targetKind: 'admin_user',
    targetId: targetUser.id,
    after: { email, role, notes },
  })

  return NextResponse.json({ ok: true, user_id: targetUser.id })
}
