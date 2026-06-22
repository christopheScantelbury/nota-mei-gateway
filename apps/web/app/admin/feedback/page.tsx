import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canRead, getAdminContext } from '@/lib/admin/permissions'
import FeedbackList from './FeedbackList'

export const metadata = { title: 'Feedback dos clientes' }

interface Row {
  id: string
  user_id: string | null
  empresa_id: string | null
  tipo: 'bug' | 'sugestao' | 'duvida' | 'elogio'
  mensagem: string
  url: string | null
  user_agent: string | null
  screenshot_url: string | null
  status: 'open' | 'triaging' | 'resolved' | 'wontfix'
  resolved_at: string | null
  notes_admin: string | null
  created_at: string
  user_email?: string | null
}

export default async function FeedbackPage({
  searchParams,
}: { searchParams: { status?: string; tipo?: string } }) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  if (!canRead(ctx, '/admin/feedback')) redirect('/admin')

  const admin = createAdminClient()
  let query = admin
    .from('customer_feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.tipo) query = query.eq('tipo', searchParams.tipo)

  const { data: rows } = await query.returns<Row[]>()

  // Resolve emails (best-effort) via auth.admin.listUsers
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map<string, string>()
  for (const u of usersList?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  const items: Row[] = (rows ?? []).map((r) => ({
    ...r,
    user_email: r.user_id ? emailMap.get(r.user_id) ?? null : null,
  }))

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Feedback dos clientes</h1>
      <p className="text-text-2 text-sm mb-6">
        Bugs, sugestões, dúvidas e elogios recebidos via botão 💬 do dashboard.
      </p>
      <FeedbackList
        initialItems={items}
        canWrite={ctx.isSuperAdmin || (ctx.grants.get('/admin/feedback')?.canWrite ?? false)}
        filterStatus={searchParams.status ?? null}
        filterTipo={searchParams.tipo ?? null}
      />
    </div>
  )
}
