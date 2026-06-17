/**
 * POST /admin/api/landing/[slug]/rollback — restaura live anterior do publish_history.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

interface Ctx { params: { slug: string } }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const admin = createAdminClient()
  const { data: page } = await admin
    .from('landing_pages')
    .select('id')
    .eq('slug', params.slug)
    .single<{ id: string }>()
  if (!page) return NextResponse.json({ error: 'PAGE_NOT_FOUND' }, { status: 404 })

  const { data: lastSnapshot } = await admin
    .from('landing_publish_history')
    .select('id, sections_snapshot')
    .eq('page_id', page.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; sections_snapshot: Array<{ id: string; live_data: unknown; ordem: number; visible: boolean; tipo: string }> }>()

  if (!lastSnapshot) {
    return NextResponse.json({ error: 'NO_SNAPSHOT', message: 'Sem histórico de publish anterior' }, { status: 404 })
  }

  for (const s of lastSnapshot.sections_snapshot) {
    await admin
      .from('landing_sections')
      .update({
        live_data: s.live_data,
        ordem: s.ordem,
        visible: s.visible,
        tipo: s.tipo,
      })
      .eq('id', s.id)
  }

  await logAdminAction({
    action: 'landing_rollback',
    targetKind: 'landing_page',
    targetId: page.id,
    after: { restored_from: lastSnapshot.id },
  })

  return NextResponse.json({ ok: true, restoredFrom: lastSnapshot.id })
}
