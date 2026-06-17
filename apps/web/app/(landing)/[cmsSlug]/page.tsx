/**
 * Página CMS-driven (#242).
 *
 * Renderiza qualquer slug do banco landing_pages. As pages estáticas
 * existentes (/mei, /me, etc) têm precedência via Next.js routing
 * conflict — esta rota cobre slugs novos criados via /admin/landing.
 *
 * Suporta `?preview=1` pra renderizar draft_data (modo admin).
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPageWithDraft, getPublishedPage } from '@/lib/admin/landing'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/permissions'
import SectionRenderer from '@/components/landing/SectionRenderer'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'

interface Props {
  params: { cmsSlug: string }
  searchParams: { preview?: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPublishedPage(params.cmsSlug)
  if (!page) return {}
  return {
    title: page.title ?? params.cmsSlug,
    description: page.meta_description ?? undefined,
    alternates: { canonical: `https://emitirnotafacil.com.br/${params.cmsSlug}` },
  }
}

export default async function CMSLandingPage({ params, searchParams }: Props) {
  const preview = searchParams.preview === '1'

  // Em preview, exige user admin logado.
  let page = null
  if (preview) {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (user) {
      const ctx = await getAdminContext(user.id, sb)
      if (ctx.isAdmin) {
        page = await getPageWithDraft(params.cmsSlug)
      }
    }
  }
  if (!page) {
    page = await getPublishedPage(params.cmsSlug)
  }
  if (!page) notFound()

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <Navbar />
      {preview && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 py-2 text-center text-xs">
          🚧 Modo preview — você está vendo o rascunho não publicado de /{page.slug}
        </div>
      )}
      {page.sections.map((s) => (
        <SectionRenderer key={s.id} section={s} preview={preview} />
      ))}
      <LandingFooter />
    </main>
  )
}
