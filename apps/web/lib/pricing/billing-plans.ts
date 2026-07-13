// Helper server-side que lê os planos assináveis (por tipo de empresa) do
// banco `planos` — usado pela página /billing pra montar os cards de upgrade.
//
// 2026-06-25: substitui os arrays hardcoded PLANOS_MEI / PLANOS_EMPRESA que
// ficavam defasados do banco (ex: ME Pro mostrava R$149,90/50 notas enquanto
// o banco/Stripe já cobrava R$129,90/100). Regra do projeto: preço e limite
// vêm SEMPRE do banco (editável via /admin/planos), nunca hardcode.

import { createAdminClient } from '@/lib/supabase/admin'

export interface BillingPlan {
  /** slug enviado ao /api/billing/checkout (resolve stripe_price_id server-side) */
  key:   string
  name:  string
  limit: number
  /** label pronto pra exibição — "R$ 59,99/mês" ou "R$ 5,99/nota" */
  price: string
}

// Nome canônico do banco → slug esperado pelo checkout (slugToPlanoNome inverso).
const NAME_TO_SLUG: Record<string, string> = {
  'Avulso MEI':  'avulso',
  'MEI Mensal':  'mensal',
  'MEI Plus':    'plus',
  'MEI Premium': 'premium',
  'ME Start':    'start',
  'ME Pro':      'pro',
  'ME Business': 'business',
}

// Ordem de exibição dos cards por tipo (entrada → topo).
const ORDER_MEI = ['Avulso MEI', 'MEI Mensal', 'MEI Plus', 'MEI Premium']
const ORDER_ME  = ['ME Start', 'ME Pro', 'ME Business']

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
})

interface PlanoRow {
  nome:                string
  preco_mensal_brl:    number | null
  preco_excedente_brl: number | null
  emissoes_limite:     number | null
}

function toBillingPlan(row: PlanoRow): BillingPlan {
  const mensal = row.preco_mensal_brl ?? 0
  const exced  = row.preco_excedente_brl ?? 0
  const limit  = row.emissoes_limite ?? 0

  // Avulso (limit 0, sem mensalidade): preço por nota.
  const price = mensal > 0
    ? `${BRL.format(mensal)}/mês`
    : exced > 0
      ? `${BRL.format(exced)}/nota`
      : 'Grátis'

  return {
    key:   NAME_TO_SLUG[row.nome] ?? row.nome.toLowerCase(),
    name:  row.nome,
    limit,
    price,
  }
}

/**
 * Planos assináveis pra exibir no /billing, conforme o tipo do dono da conta.
 * `isMEI=true` → catálogo MEI; senão → catálogo ME/EPP.
 *
 * Lê do banco (ativos, não-trial). Se a query falhar, devolve [] — a página
 * degrada mostrando "nenhum plano disponível" em vez de valores errados.
 */
export async function getBillingPlans(isMEI: boolean): Promise<BillingPlan[]> {
  const order = isMEI ? ORDER_MEI : ORDER_ME
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('planos')
      .select('nome, preco_mensal_brl, preco_excedente_brl, emissoes_limite')
      .eq('ativo', true)
      .in('nome', order)
    if (error) throw error

    const byName = new Map((data as PlanoRow[]).map(r => [r.nome, r]))
    return order
      .map(n => byName.get(n))
      .filter((r): r is PlanoRow => !!r)
      .map(toBillingPlan)
  } catch {
    return []
  }
}
