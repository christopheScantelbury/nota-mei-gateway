export const metadata = { title: 'Novo cliente' }

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanGate from '@/components/dashboard/PlanGate'
import ClienteForm from '@/components/dashboard/ClienteForm'

export default async function NovoClientePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const competencia = new Date().toISOString().slice(0, 7)
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', competencia)
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planName = emissao?.planos?.nome ?? 'Trial'

  return (
    <PlanGate
      planName={planName}
      feature="clientesCrud"
      icon="✏️"
      title="Criar cliente manualmente é uma feature Pro"
      description="No seu plano atual, clientes são adicionados automaticamente toda vez que você emite uma nota fiscal."
      requiredPlan="Pro"
    >
      <div className="p-4 sm:p-8 max-w-3xl">
        <Link href="/clientes" className="text-sm text-text-2 hover:text-brand-cyan transition mb-4 inline-block">
          ← Voltar para clientes
        </Link>
        <div className="mb-8">
          <h1 className="font-display text-3xl font-extrabold">Novo cliente</h1>
          <p className="text-text-2 mt-1 text-sm">
            Cadastre um tomador manualmente. CNPJs trazem os dados da Receita automaticamente.
          </p>
        </div>
        <ClienteForm />
      </div>
    </PlanGate>
  )
}
