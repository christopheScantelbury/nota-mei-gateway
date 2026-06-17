import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'

export const metadata = { title: 'Landing' }

interface PageRow {
  id: string
  slug: string
  title: string | null
  published: boolean
  published_at: string | null
}

export default async function LandingIndexPage() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/landing')) redirect('/admin')

  const admin = createAdminClient()
  const { data: pages } = await admin
    .from('landing_pages')
    .select('id, slug, title, published, published_at')
    .order('slug', { ascending: true })
    .returns<PageRow[]>()

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Landing — CMS</h1>
      <p className="text-text-2 text-sm mb-6">
        Editor de páginas públicas. Draft fica salvo; publicar copia draft → live.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(pages ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/admin/landing/${p.slug}`}
            className="rounded-xl border border-navy-600 p-5 hover:border-brand-cyan transition"
          >
            <div className="flex items-start justify-between mb-1">
              <p className="font-display font-extrabold text-lg">/{p.slug === 'home' ? '' : p.slug}</p>
              {p.published ? (
                <span className="text-xs text-nota-autorizada">● publicada</span>
              ) : (
                <span className="text-xs text-text-2">○ rascunho</span>
              )}
            </div>
            {p.title && <p className="text-xs text-text-2 mb-2 truncate">{p.title}</p>}
            {p.published_at && (
              <p className="text-xs text-text-2 mt-2">
                Última publish: {new Date(p.published_at).toLocaleString('pt-BR')}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
