import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MigrarMEClient from './MigrarMEClient'

export const metadata: Metadata = {
  title: 'Migrar para ME',
}

export default async function MigrarMEPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the active empresa — only MEI companies can migrate
  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, tipo, razao_social, cnpj')
    .eq('user_id', user.id)
    .eq('tipo', 'MEI')
    .maybeSingle()

  if (!empresa) redirect('/configuracoes')

  return <MigrarMEClient empresa={empresa} />
}
