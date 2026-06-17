/**
 * POST /admin/api/landing/[slug]/sections — cria nova section (draft).
 * PUT  /admin/api/landing/[slug]/sections — bulk update (reorder, edit) em uma única transação lógica.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

interface Ctx { params: { slug: string } }

const VALID_TIPOS = [
  'hero', 'pricing', 'features', 'faq', 'cta',
  'testimonials', 'how_it_works', 'urgency_banner',
  'competitor_table', 'ecossistema', 'custom_html',
]

export async function POST(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { tipo?: string; ordem?: number; draft_data?: Record<string, unknown> }
  try { body = await request.json() } catch { body = {} }

  if (!body.tipo || !VALID_TIPOS.includes(body.tipo)) {
    return NextResponse.json({ error: 'VALIDATION', message: 'tipo inválido' }, { status: 422 })
  }

  const admin = createAdminClient()
  const { data: page } = await admin
    .from('landing_pages')
    .select('id')
    .eq('slug', params.slug)
    .single<{ id: string }>()
  if (!page) return NextResponse.json({ error: 'PAGE_NOT_FOUND' }, { status: 404 })

  const { data, error } = await admin
    .from('landing_sections')
    .insert({
      page_id: page.id,
      tipo: body.tipo,
      ordem: body.ordem ?? 999,
      draft_data: body.draft_data ?? {},
      live_data: null,
      visible: true,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })

  await logAdminAction({
    action: 'landing_section_edit',
    targetKind: 'landing_section',
    targetId: data.id,
    after: data,
  })

  return NextResponse.json({ ok: true, section: data })
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/landing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { sections?: Array<{ id: string; ordem?: number; draft_data?: Record<string, unknown>; visible?: boolean; tipo?: string }> }
  try { body = await request.json() } catch { body = {} }

  if (!body.sections || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: 'VALIDATION', message: 'sections array obrigatório' }, { status: 422 })
  }

  const admin = createAdminClient()
  const { data: page } = await admin
    .from('landing_pages')
    .select('id')
    .eq('slug', params.slug)
    .single<{ id: string }>()
  if (!page) return NextResponse.json({ error: 'PAGE_NOT_FOUND' }, { status: 404 })

  const errors: Array<{ id: string; err: string }> = []
  let updated = 0
  for (const s of body.sections) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (s.ordem !== undefined) patch.ordem = s.ordem
    if (s.draft_data !== undefined) patch.draft_data = s.draft_data
    if (s.visible !== undefined) patch.visible = s.visible
    if (s.tipo !== undefined && VALID_TIPOS.includes(s.tipo)) patch.tipo = s.tipo

    const { error } = await admin
      .from('landing_sections')
      .update(patch)
      .eq('id', s.id)
      .eq('page_id', page.id)  // segurança: só editar sections da própria page
    if (error) {
      errors.push({ id: s.id, err: error.message })
    } else {
      updated++
    }
  }

  await logAdminAction({
    action: 'landing_section_edit',
    targetKind: 'landing_section',
    targetId: page.id,
    after: { updated, errors: errors.length },
  })

  return NextResponse.json({ ok: errors.length === 0, updated, errors })
}

// DELETE handled separately em /sections/[id]
