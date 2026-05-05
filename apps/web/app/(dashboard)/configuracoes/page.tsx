export const metadata = { title: 'Configurações' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfiguracoesTabs from '@/components/dashboard/ConfiguracoesTabs'

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const [meiResult, keysResult] = await Promise.all([
    supabase
      .from('meis')
      .select('cnpj, razao_social, email, municipio_ibge, cert_valid_until')
      .eq('id', session.user.id)
      .single<{
        cnpj: string
        razao_social: string
        email: string
        municipio_ibge: string
        cert_valid_until: string | null
      }>(),

    supabase
      .from('api_keys')
      .select('id, key_prefix, label, created_at')
      .eq('mei_id', session.user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .returns<{ id: string; key_prefix: string; label: string | null; created_at: string }[]>(),
  ])

  if (!meiResult.data) redirect('/login')

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Configurações</h1>
        <p className="text-text-2 mt-1 text-sm">Gerencie seu perfil, certificado, API Keys e webhook padrão.</p>
      </div>

      <ConfiguracoesTabs
        mei={meiResult.data}
        apiKeys={keysResult.data ?? []}
      />
    </div>
  )
}
