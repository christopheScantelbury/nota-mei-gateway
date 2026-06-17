/**
 * DELETE /admin/api/landing/[slug]/sections/[id] — remove section (hard delete).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

interface Ctx { params: { slug: string; id: string } }

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('landing_sections')
    .select('*')
    .eq('id', params.id)
    .single()

  const { error } = await admin.from('landing_sections').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })

  await logAdminAction({
    action: 'landing_section_edit',
    targetKind: 'landing_section',
    targetId: params.id,
    before,
    after: null,
  })

  return NextResponse.json({ ok: true })
}
