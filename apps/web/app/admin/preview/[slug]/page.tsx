/**
 * Preview de página CMS — admin only (BUG-003 QA 2026-06-17).
 *
 * As páginas estáticas existentes em apps/web/app/(landing)/(mei|me|gateway|
 * comparativo)/page.tsx têm precedência sobre o catch-all /[cmsSlug], então
 * `/mei?preview=1` renderizava a versão hardcoded sem banner de preview.
 *
 * Solução: rota dedicada `/admin/preview/[slug]` que sempre lê draft_data
 * e não conflita com nenhuma página existente. Builder abre esta URL.
 */
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/permissions'
import { getPageWithDraft } from '@/lib/admin/landing'
import SectionRenderer from '@/components/landing/SectionRenderer'

export const metadata = { title: 'Preview — Admin' }

interface Props { params: { slug: string } }

export default async function PreviewPage({ params }: Props) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!ctx.isAdmin) redirect('/home')

  const page = await getPageWithDraft(params.slug)
  if (!page) notFound()

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <div className="sticky top-0 z-50 bg-amber-500/95 backdrop-blur border-b border-amber-700 py-2 px-4 text-center text-xs text-navy-900">
        🚧 <strong>Modo preview</strong> · rascunho não publicado de
        <code className="mx-1 px-1 rounded bg-navy-900/10">/{page.slug === 'home' ? '' : page.slug}</code>
        · <a href={`/admin/landing/${params.slug}`} className="underline">voltar pro editor</a>
      </div>
      {page.sections.map((s) => (
        <SectionRenderer key={s.id} section={s} preview />
      ))}
    </main>
  )
}
