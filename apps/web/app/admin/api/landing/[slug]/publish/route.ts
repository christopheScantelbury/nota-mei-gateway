/**
 * POST /admin/api/landing/[slug]/publish — copia draft → live + snapshot anterior.
 * POST /admin/api/landing/[slug]/publish/rollback — restaura live anterior.
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

  // 1. Snapshot do live atual (pra rollback futuro)
  const { data: currentSections } = await admin
    .from('landing_sections')
    .select('id, tipo, ordem, live_data, visible')
    .eq('page_id', page.id)
    .returns<Array<{ id: string; tipo: string; ordem: number; live_data: unknown; visible: boolean }>>()

  await admin.from('landing_publish_history').insert({
    page_id: page.id,
    published_by: user.id,
    sections_snapshot: currentSections ?? [],
    notes: `Snapshot pré-publish em ${new Date().toISOString()}`,
  })

  // 2. Copia draft → live em todas as sections
  // Postgres: live_data = draft_data
  const { error: copyErr } = await admin.rpc('landing_publish_page' as never, { p_page_id: page.id } as never)
  // Fallback caso a function não exista: itera manualmente
  if (copyErr) {
    const { data: sections } = await admin
      .from('landing_sections')
      .select('id, draft_data')
      .eq('page_id', page.id)
      .returns<Array<{ id: string; draft_data: unknown }>>()
    for (const s of sections ?? []) {
      await admin.from('landing_sections').update({ live_data: s.draft_data }).eq('id', s.id)
    }
  }

  // 3. Marca page como published
  await admin
    .from('landing_pages')
    .update({
      published: true,
      published_at: new Date().toISOString(),
      published_by: user.id,
    })
    .eq('id', page.id)

  await logAdminAction({
    action: 'landing_publish',
    targetKind: 'landing_page',
    targetId: page.id,
    after: { slug: params.slug },
  })

  return NextResponse.json({ ok: true, publishedAt: new Date().toISOString() })
}
