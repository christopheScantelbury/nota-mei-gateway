import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/dashboard/Sidebar'
import type { MEI } from '@/lib/types'

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
    redirect('/')
  }

  // Load MEI profile for sidebar display.
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, razao_social, email, municipio_ibge, stripe_customer_id')
    .eq('id', session.user.id)
    .single<MEI>()

  const razaoSocial = mei?.razao_social ?? session.user.email ?? 'Meu painel'

  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body flex">
      <Sidebar razaoSocial={razaoSocial} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
