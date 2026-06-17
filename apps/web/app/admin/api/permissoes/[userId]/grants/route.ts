/**
 * PUT /admin/api/permissoes/[userId]/grants — substitui grants do user.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext, invalidateAdminCache } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

interface Ctx { params: { userId: string } }

interface GrantInput {
  page_path: string
  can_read: boolean
  can_write: boolean
}

const ALLOWED_PATHS = [
  '/admin/usuarios',
  '/admin/notas',
  '/admin/planos',
  '/admin/landing',
]

export async function PUT(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { grants?: GrantInput[] }
  try { body = await request.json() } catch { body = {} }
  const grants = (body.grants ?? []).filter(
    (g) =>
      ALLOWED_PATHS.includes(g.page_path) &&
      typeof g.can_read === 'boolean' &&
      typeof g.can_write === 'boolean' &&
      (g.can_read || g.can_write),
  )

  const admin = createAdminClient()
  // Snapshot antes pra audit.
  const { data: beforeGrants } = await admin
    .from('admin_page_grants')
    .select('page_path, can_read, can_write')
    .eq('user_id', params.userId)
    .returns<GrantInput[]>()

  // Replace strategy: delete tudo + insert novo. Transação seria ideal mas
  // o REST não expõe; aceitamos pequena janela de inconsistência.
  await admin.from('admin_page_grants').delete().eq('user_id', params.userId)

  if (grants.length > 0) {
    const { error: insErr } = await admin.from('admin_page_grants').insert(
      grants.map((g) => ({
        user_id: params.userId,
        page_path: g.page_path,
        can_read: g.can_read,
        can_write: g.can_write,
        granted_by: user.id,
      })),
    )
    if (insErr) {
      return NextResponse.json({ error: 'DB_ERROR', message: insErr.message }, { status: 500 })
    }
  }

  invalidateAdminCache(params.userId)
  await logAdminAction({
    action: 'user_grant_change',
    targetKind: 'admin_user',
    targetId: params.userId,
    before: beforeGrants ?? [],
    after: grants,
  })

  return NextResponse.json({ ok: true })
}
