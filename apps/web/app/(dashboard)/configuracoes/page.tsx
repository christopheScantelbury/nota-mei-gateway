export const metadata = { title: 'Configurações' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfiguracoesTabs from '@/components/dashboard/ConfiguracoesTabs'

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  // Use getUser() (validates JWT server-side) instead of getSession() (trusts client cookie)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  type ProfileData = {
    cnpj: string
    razao_social: string
    email: string
    municipio_ibge: string
    cert_valid_until: string | null
    tipo?: string | null
  }

  // Try empresas first (ME/EPP), fall back to meis (MEI legacy)
  const empresaResult = await supabase
    .from('empresas')
    .select('cnpj, razao_social, email, municipio_ibge, cert_valid_until, tipo')
    .eq('user_id', user.id)
    .maybeSingle<ProfileData>()

  let profileData: ProfileData | null = empresaResult.data ?? null

  if (!profileData) {
    const meiResult = await supabase
      .from('meis')
      .select('cnpj, razao_social, email, municipio_ibge, cert_valid_until')
      .eq('id', user.id)
      .single<ProfileData>()
    profileData = meiResult.data ?? null
  }

  if (!profileData) redirect('/login')

  // Users in `meis` table (legacy) or tipo='MEI' are end-users without API access
  const empresaTipo: 'MEI' | 'ME' | 'EPP' =
    (empresaResult.data?.tipo as 'MEI' | 'ME' | 'EPP') ?? 'MEI'
  const isMei = empresaTipo === 'MEI'

  // RLS on api_keys filters by empresa_id (ME/EPP) or mei_id (MEI legacy) — no explicit filter needed
  const keysResult = await supabase
    .from('api_keys')
    .select('id, key_prefix, label, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .returns<{ id: string; key_prefix: string; label: string | null; created_at: string }[]>()

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Configurações</h1>
        <p className="text-text-2 mt-1 text-sm">
          {isMei
            ? 'Gerencie seu perfil e certificado digital.'
            : 'Gerencie seu perfil, certificado, API Keys e webhook padrão.'}
        </p>
      </div>

      <ConfiguracoesTabs
        mei={profileData}
        apiKeys={keysResult.data ?? []}
        empresaTipo={empresaTipo}
      />
    </div>
  )
}
