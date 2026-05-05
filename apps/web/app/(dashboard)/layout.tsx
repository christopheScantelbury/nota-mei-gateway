import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import NotificationBell from '@/components/dashboard/NotificationBell'
import type { MEI } from '@/lib/types'

export const metadata: Metadata = {
  title: {
    default: 'Painel — Nota Fácil MEI',
    template: '%s — Nota Fácil MEI',
  },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Load MEI profile for sidebar display.
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id')
    .eq('id', session.user.id)
    .single<MEI>()

  const razaoSocial = mei?.razao_social ?? session.user.email ?? 'Meu painel'

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
      <Sidebar razaoSocial={razaoSocial} notificationBell={<NotificationBell />} />
      <main
        id="main-content"
        className="flex-1 overflow-auto pt-14 lg:pt-0"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  )
}
