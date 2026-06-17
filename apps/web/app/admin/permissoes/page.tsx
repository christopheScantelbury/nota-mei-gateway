import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminContext } from '@/lib/admin/permissions'
import PermissoesClient from './PermissoesClient'

export const metadata = { title: 'Permissões' }

interface AdminRow {
  user_id: string
  role: 'admin' | 'super_admin'
  ativo: boolean
  notes: string | null
  created_at: string
  email: string
  grants: { page_path: string; can_read: boolean; can_write: boolean }[]
}

export default async function PermissoesPage() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const ctx = await getAdminContext(user.id, sb)
  // Apenas super_admin gerencia permissões (defesa em profundidade — middleware já filtra)
  if (!ctx.isSuperAdmin) redirect('/admin')

  // Service role pra ler todos os admins + emails do auth.users + grants em paralelo.
  const admin = createAdminClient()
  const [{ data: admins }, { data: grants }] = await Promise.all([
    admin
      .from('admin_users')
      .select('user_id, role, ativo, notes, created_at')
      .order('created_at', { ascending: false })
      .returns<Omit<AdminRow, 'email' | 'grants'>[]>(),
    admin
      .from('admin_page_grants')
      .select('user_id, page_path, can_read, can_write')
      .returns<{ user_id: string; page_path: string; can_read: boolean; can_write: boolean }[]>(),
  ])

  // Resolve emails via auth.admin.listUsers
  const { data: usersListData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map<string, string>()
  for (const u of usersListData?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email)
  }

  const grantsByUser = new Map<string, AdminRow['grants']>()
  for (const g of grants ?? []) {
    if (!grantsByUser.has(g.user_id)) grantsByUser.set(g.user_id, [])
    grantsByUser.get(g.user_id)!.push({
      page_path: g.page_path,
      can_read: g.can_read,
      can_write: g.can_write,
    })
  }

  const rows: AdminRow[] = (admins ?? []).map((a) => ({
    ...a,
    email: emailMap.get(a.user_id) ?? '—',
    grants: grantsByUser.get(a.user_id) ?? [],
  }))

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold mb-2">Permissões</h1>
      <p className="text-text-2 text-sm mb-6">
        Gerencie quem tem acesso à área admin e o que cada um pode fazer.
      </p>

      <PermissoesClient initialAdmins={rows} currentUserId={user.id} />
    </div>
  )
}
