import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  // Middleware já garante role === 'admin', mas verificamos aqui como segunda camada
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/home')
  }

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
