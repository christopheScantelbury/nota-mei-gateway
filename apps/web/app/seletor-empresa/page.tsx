import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SeletorEmpresaClient } from './SeletorEmpresaClient'

export const metadata: Metadata = {
  title: { absolute: 'Selecionar empresa — Nota Fácil MEI' },
}

export default async function SeletorEmpresaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: empresas } = await supabase
    .from('empresas')
    .select(`
      id, tipo, razao_social, cnpj, regime_tributario, trial_me,
      emissoes_mensais(total_emitidas, competencia)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!empresas?.length) redirect('/cadastro')
  if (empresas.length === 1) redirect('/notas')

  return <SeletorEmpresaClient empresas={empresas} />
}
