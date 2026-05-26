export const metadata = { title: 'Editar cliente' }

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanGate from '@/components/dashboard/PlanGate'
import ClienteForm from '@/components/dashboard/ClienteForm'
import type { Cliente } from '@/lib/types-cliente'

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Cliente>()

  if (!cliente) notFound()

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
      title="Editar cliente é uma feature Pro"
      description="No seu plano atual, os dados dos clientes são atualizados automaticamente a partir das notas emitidas."
      requiredPlan="Pro"
    >
      <div className="p-4 sm:p-8 max-w-3xl">
        <Link href={`/clientes/${cliente.id}`} className="text-sm text-text-2 hover:text-brand-cyan transition mb-4 inline-block">
          ← Voltar para o cliente
        </Link>
        <div className="mb-8">
          <h1 className="font-display text-3xl font-extrabold truncate">Editar {cliente.razao_social}</h1>
        </div>
        <ClienteForm initial={cliente} />
      </div>
    </PlanGate>
  )
}
