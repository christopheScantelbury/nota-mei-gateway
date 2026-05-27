export const metadata = { title: 'Links de Emissão' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanGate from '@/components/dashboard/PlanGate'
import LinksList from './LinksList'

export default async function LinksPage() {
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

  // Carrega links — depois enriquecemos com nomes em queries separadas
  const { data: rawLinks } = await supabase
    .from('emissao_links')
    .select(`
      id, token, nome, template_id, recorrencia_id,
      usos, ultima_emissao_em, ultima_nota_id,
      ativo, revogado_em, created_at
    `)
    .order('created_at', { ascending: false })
    .returns<{
      id: string; token: string; nome: string;
      template_id: string | null; recorrencia_id: string | null;
      usos: number; ultima_emissao_em: string | null; ultima_nota_id: string | null;
      ativo: boolean; revogado_em: string | null; created_at: string;
    }[]>()

  const templateIds    = (rawLinks ?? []).map(l => l.template_id).filter((x): x is string => !!x)
  const recorrenciaIds = (rawLinks ?? []).map(l => l.recorrencia_id).filter((x): x is string => !!x)

  const [tplsRes, recsRes] = await Promise.all([
    templateIds.length
      ? supabase.from('nota_templates').select('id, nome').in('id', templateIds).returns<{ id: string; nome: string }[]>()
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    recorrenciaIds.length
      ? supabase.from('nota_recorrencias').select('id, nome').in('id', recorrenciaIds).returns<{ id: string; nome: string }[]>()
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ])

  const tplMap = new Map((tplsRes.data ?? []).map(t => [t.id, t.nome]))
  const recMap = new Map((recsRes.data ?? []).map(r => [r.id, r.nome]))

  const links = (rawLinks ?? []).map(l => ({
    ...l,
    nota_templates:    l.template_id ? { nome: tplMap.get(l.template_id) ?? '—' } : null,
    nota_recorrencias: l.recorrencia_id ? { nome: recMap.get(l.recorrencia_id) ?? '—' } : null,
  }))

  return (
    <PlanGate
      planName={planName}
      feature="webhooks"
      icon="🔗"
      title="Links de Emissão Rápida"
      description="Crie links únicos que você salva nos favoritos do celular. Acessou → 1 toque → nota emitida sem precisar entrar no sistema."
      requiredPlan="Starter"
    >
      <div className="p-4 sm:p-8 max-w-4xl">
        <LinksList initial={links ?? []} />
      </div>
    </PlanGate>
  )
}
