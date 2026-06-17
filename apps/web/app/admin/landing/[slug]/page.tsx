import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canRead, canWrite, getAdminContext } from '@/lib/admin/permissions'
import { getPageWithDraft } from '@/lib/admin/landing'
import LandingBuilder from './LandingBuilder'

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props) {
  return { title: `Landing /${params.slug}` }
}

export default async function LandingEditPage({ params }: Props) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/landing')) redirect('/admin')

  const page = await getPageWithDraft(params.slug)
  if (!page) redirect('/admin/landing')

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <LandingBuilder
        page={page}
        canWrite={canWrite(ctx, '/admin/landing')}
      />
    </div>
  )
}
