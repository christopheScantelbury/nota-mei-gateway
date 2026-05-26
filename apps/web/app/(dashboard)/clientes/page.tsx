export const metadata = { title: 'Clientes' }

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanGate from '@/components/dashboard/PlanGate'
import ClientesList from '@/components/dashboard/ClientesList'
import type { Cliente } from '@/lib/types-cliente'

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; tag?: string; arquivados?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Resolve plano atual pra montar gate
  const competencia = new Date().toISOString().slice(0, 7)
  const { data: emissao } = await supabase
    .from('emissoes_mensais')
    .select('planos(nome)')
    .eq('competencia', competencia)
    .maybeSingle<{ planos: { nome: string } | null }>()

  const planName = emissao?.planos?.nome ?? 'Trial'

  // Carrega lista inicial (server-side) — client-side faz refresh em buscas
  const q          = searchParams.q?.trim() ?? ''
  const tag        = searchParams.tag?.trim() ?? ''
  const arquivados = searchParams.arquivados === 'true'

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' })
    .eq('ativo', !arquivados)
    .order('ultima_emissao_em', { ascending: false, nullsFirst: false })
    .order('razao_social', { ascending: true })
    .limit(50)

  if (q) {
    const numeric = q.replace(/\D/g, '')
    if (numeric.length >= 3) {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,documento.ilike.%${numeric}%`)
    } else {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`)
    }
  }
  if (tag) query = query.contains('tags', [tag])

  const { data: clientes, count } = await query.returns<Cliente[]>()

  // Distinct tags pra filtro (best-effort — ignora se falhar)
  const { data: allTagged } = await supabase
    .from('clientes')
    .select('tags')
    .eq('ativo', true)
    .not('tags', 'eq', '{}')
    .limit(200)
    .returns<{ tags: string[] }[]>()

  const allTags = Array.from(new Set((allTagged ?? []).flatMap((r) => r.tags))).sort()

  return (
    <PlanGate
      planName={planName}
      feature="clientesRead"
      icon="👥"
      title="Aba de Clientes disponível a partir do Starter"
      description="Centralize seus tomadores cadastrados, veja quanto já faturou com cada um e use o autocomplete na hora de emitir notas — chega de digitar CNPJ toda vez."
      requiredPlan="Starter"
    >
      <ClientesList
        initial={clientes ?? []}
        total={count ?? 0}
        planName={planName}
        allTags={allTags}
        searchQ={q}
        searchTag={tag}
        showArquivados={arquivados}
      />
    </PlanGate>
  )
}
