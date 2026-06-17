/**
 * GET  /admin/api/landing/[slug] — fetch page com sections (draft + live)
 * PATCH /admin/api/landing/[slug] — atualiza title/meta
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import { getPageWithDraft } from '@/lib/admin/landing'

interface Ctx { params: { slug: string } }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const page = await getPageWithDraft(params.slug)
  if (!page) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ page })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { title?: string; meta_description?: string }
  try { body = await request.json() } catch { body = {} }

  const admin = createAdminClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title !== undefined) patch.title = body.title
  if (body.meta_description !== undefined) patch.meta_description = body.meta_description

  const { data, error } = await admin
    .from('landing_pages')
    .update(patch)
    .eq('slug', params.slug)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })

  await logAdminAction({
    action: 'landing_section_edit',
    targetKind: 'landing_page',
    targetId: data.id,
    after: patch,
  })

  return NextResponse.json({ ok: true, page: data })
}
