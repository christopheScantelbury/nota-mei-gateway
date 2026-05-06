import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import NotificationBell from '@/components/dashboard/NotificationBell'
import type { MEI } from '@/lib/types'

// ── Metadata dinâmico por produto ───────────────────────────────────────────
// Usa tipo_usuario do banco para determinar o produto correto.
// Ambos os produtos rodam no mesmo domínio (emitirnotafacil.com.br),
// então hostname não é suficiente — precisamos consultar o perfil do usuário.

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let product = 'Nota MEI Gateway' // default para não-autenticados e Gateway
  if (user) {
    const { data: mei } = await supabase
      .from('meis')
      .select('tipo_usuario')
      .eq('id', user.id)
      .single<{ tipo_usuario: 'mei' | 'gateway' }>()
    if (mei?.tipo_usuario === 'mei') {
      product = 'Nota Fácil MEI'
    }
  }

  return {
    title: {
      default: `Painel — ${product}`,
      template: `%s — ${product}`,
    },
  }
}

// ── Layout ──────────────────────────────────────────────────────────────────

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

  // Carrega perfil MEI para a sidebar (logo MEI vs Gateway, filtro de nav)
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id, tipo_usuario')
    .eq('id', user.id)
    .single<MEI>()

  const razaoSocial  = mei?.razao_social ?? user.email ?? 'Meu painel'
  const isAdmin      = user.app_metadata?.role === 'admin'
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
