import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import NotificationBell from '@/components/dashboard/NotificationBell'
import type { MEI } from '@/lib/types'

// ── Domínios de produção por produto ────────────────────────────────────────
const PRODUCT_DOMAINS: Record<'mei' | 'gateway', string> = {
  mei:     'notafacilmei.com.br',
  gateway: 'notameigateway.com.br',
}

// Hostname do Vercel preview — nunca aplicar domain guard aqui
const DEV_HOSTS = ['localhost', '127.0.0.1', 'vercel.app']

function isProductionHost(host: string) {
  return !DEV_HOSTS.some((h) => host.includes(h))
}

// ── Metadata dinâmico por produto ───────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host') ?? ''
  const isMeiDomain = host.includes('notafacilmei.com.br')
  const product = isMeiDomain ? 'Nota Fácil MEI' : 'Nota MEI Gateway'

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

  // Carrega perfil MEI para sidebar e domain guard
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id, tipo_usuario')
    .eq('id', user.id)
    .single<MEI>()

  const razaoSocial  = mei?.razao_social ?? user.email ?? 'Meu painel'
  const isAdmin      = user.app_metadata?.role === 'admin'
  const tipoUsuario: 'mei' | 'gateway' = mei?.tipo_usuario ?? 'gateway'

  // ── Domain guard: em produção, usuário MEI só acessa notafacilmei.com.br
  //    e usuário gateway só acessa notameigateway.com.br ─────────────────────
  const host = headers().get('host') ?? ''
  if (isProductionHost(host)) {
    const expectedDomain = PRODUCT_DOMAINS[tipoUsuario]
    if (!host.includes(expectedDomain)) {
      redirect(`https://${expectedDomain}/notas`)
    }
  }

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
