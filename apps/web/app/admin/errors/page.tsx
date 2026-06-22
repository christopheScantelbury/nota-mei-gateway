import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'
import ErrorsList from './ErrorsList'

export const metadata = { title: 'Errors' }

interface Row {
  id: string
  fingerprint: string
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  stack: string | null
  url: string | null
  user_id: string | null
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  resolved: boolean
}

export default async function ErrorsPage({
  searchParams,
}: { searchParams: { resolved?: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/errors')) redirect('/admin')

  const showResolved = searchParams.resolved === '1'

  const admin = createAdminClient()
  const { data } = await admin
    .from('error_log')
    .select('id, fingerprint, level, source, message, stack, url, user_id, occurrence_count, first_seen_at, last_seen_at, resolved')
    .eq('resolved', showResolved)
    .order('last_seen_at', { ascending: false })
    .limit(200)
    .returns<Row[]>()

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Errors</h1>
      <p className="text-text-2 text-sm mb-6">
        Errors capturados pelo error tracking in-house. Dedupe via fingerprint
        (mesmo error agrupa em 1 row + incrementa occurrence_count).
      </p>
      <ErrorsList
        initialItems={data ?? []}
        canWrite={ctx.isSuperAdmin || (ctx.grants.get('/admin/errors')?.canWrite ?? false)}
        showResolved={showResolved}
      />
    </div>
  )
}
