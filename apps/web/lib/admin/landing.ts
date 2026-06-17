/**
 * Helpers compartilhados pro CMS landing (#240/#242/#243).
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface LandingSection {
  id: string
  page_id: string
  tipo: string
  ordem: number
  draft_data: Record<string, unknown>
  live_data: Record<string, unknown> | null
  visible: boolean
}

export interface LandingPage {
  id: string
  slug: string
  title: string | null
  meta_description: string | null
  published: boolean
  published_at: string | null
  sections: LandingSection[]
}

/**
 * Busca page com sections em DRAFT (pra editor).
 */
export async function getPageWithDraft(slug: string): Promise<LandingPage | null> {
  const sb = createAdminClient()
  const { data: page } = await sb
    .from('landing_pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<LandingPage>()
  if (!page) return null
  const { data: sections } = await sb
    .from('landing_sections')
    .select('*')
    .eq('page_id', page.id)
    .order('ordem', { ascending: true })
    .returns<LandingSection[]>()
  return { ...page, sections: sections ?? [] }
}

/**
 * Busca page com sections em LIVE (pra renderizar a landing pública).
 * Filtra apenas visible=true E que tenham live_data. Para SSR.
 */
export async function getPublishedPage(slug: string): Promise<LandingPage | null> {
  const sb = createAdminClient()
  const { data: page } = await sb
    .from('landing_pages')
    .select('id, slug, title, meta_description, published, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  if (!page) return null
  const { data: rows } = await sb
    .from('landing_sections')
    .select('id, page_id, tipo, ordem, live_data, visible, draft_data')
    .eq('page_id', page.id)
    .eq('visible', true)
    .not('live_data', 'is', null)
    .order('ordem', { ascending: true })
    .returns<LandingSection[]>()
  return {
    ...page,
    sections: rows ?? [],
  } as LandingPage
}
