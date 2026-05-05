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
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Load MEI profile for sidebar display.
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id, tipo_usuario')
    .eq('id', user.id)
    .single<MEI>()

  const razaoSocial = mei?.razao_social ?? user.email ?? 'Meu painel'

  // app_metadata só pode ser definido server-side (service role) — seguro contra spoofing
  const isAdmin = user.app_metadata?.role === 'admin'

  // Determina o tipo de usuário: 'mei' vê só itens de emissão; 'gateway' vê tudo
  const tipoUsuario: 'mei' | 'gateway' = mei?.tipo_usuario ?? 'gateway'

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body lg:flex">
      <Sidebar
        razaoSocial={razaoSocial}
        isAdmin={isAdmin}
        tipoUsuario={tipoUsuario}
        notificationBell={<NotificationBell />}
      />
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
