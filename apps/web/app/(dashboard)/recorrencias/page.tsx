export const metadata = { title: 'Automações' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanGate from '@/components/dashboard/PlanGate'
import RecorrenciasList from './RecorrenciasList'
import type { RecorrenciaRow } from '@/app/api/recorrencias/route'

export default async function RecorrenciasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Plan gate: Starter+ tem acesso (antes era só Business).
  // Tipos: MEI + ME + EPP (antes era só ME/EPP).
  const competencia = new Date().toISOString().slice(0, 7)
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', competencia)
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planName = emissao?.planos?.nome ?? 'Trial'

  // Carrega automações diretamente do Supabase (RLS filtra)
  const { data: rows } = await supabase
    .from('nota_recorrencias')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<RecorrenciaRow[]>()

  return (
    <PlanGate
      planName={planName}
      feature="webhooks"  /* reaproveita gate "Starter+" — atualizar quando criar feature dedicada */
      icon="🔄"
      title="Automações de emissão"
      description="Configure regras pra emitir notas automaticamente — todo mês no dia que você escolher, sem precisar abrir o sistema. Opção de enviar a nota por email pro cliente automaticamente após a autorização."
      requiredPlan="Starter"
    >
      <div className="p-4 sm:p-8 max-w-5xl">
        <RecorrenciasList initialData={(rows ?? []) as unknown as Parameters<typeof RecorrenciasList>[0]['initialData']} />
      </div>
    </PlanGate>
  )
}
