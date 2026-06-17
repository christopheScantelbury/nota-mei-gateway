import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminContext } from '@/lib/admin/permissions'
import AdminSidebar from '@/components/admin/AdminSidebar'

export const metadata: Metadata = {
  title: {
    default: 'Admin — Nota Fácil MEI',
    template: '%s — Admin',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Segunda camada de defesa — middleware já filtrou via admin_page_grants.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/home')

  const ctx = await getAdminContext(user.id, supabase)
  if (!ctx.isAdmin) redirect('/home')

  // Pra sidebar: passa lista de paths que o user tem READ.
  const allowedPaths = ctx.isSuperAdmin
    ? null  // null = todos
    : Array.from(ctx.grants.entries())
        .filter(([, p]) => p.canRead)
        .map(([path]) => path)

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
      <AdminSidebar isSuperAdmin={ctx.isSuperAdmin} allowedPaths={allowedPaths} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
