// Server-side helper que mescla metadata da home (`ANCHOR_PLAN_META`) com os
// dados ao vivo do banco (`planos` table — editada via /admin/planos).
//
// Regra do projeto (2026-06-25): preço, limite e descrição_curta vêm do banco;
// bullets/CTA/badge vêm do metadata. Se a query falhar (cold start, RLS, banco
// fora do ar), cai pro `fallback` congelado no metadata — a home nunca renderiza
// sem preço.

import { createAdminClient } from '@/lib/supabase/admin'
import type { PricingPlan } from '@/lib/pricing/types'
import { ANCHOR_PLAN_META, type PricingPlanMeta } from '@/data/pricing'

interface PlanoRow {
  nome:                 string
  descricao_curta:      string | null
  preco_mensal_brl:     number | null
  preco_excedente_brl:  number | null
  emissoes_limite:      number | null
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style:                 'currency',
  currency:              'BRL',
  minimumFractionDigits: 2,
})

/** "R$ 19,90/mês" · "Grátis · pague por uso" · "R$ 5,99/nota" */
function formatPriceLabel(row: PlanoRow): string {
  const mensal = row.preco_mensal_brl ?? 0
  const exced  = row.preco_excedente_brl ?? 0
  const limit  = row.emissoes_limite ?? 0

  if (mensal > 0) return `${BRL.format(mensal)}/mês`
  if (exced > 0 && limit === 0) return `${BRL.format(exced)}/nota`
  return 'Grátis · pague por uso'
}

/** "5 notas/mês · R$ 0,80 por nota excedente" */
function formatNotes(row: PlanoRow): string {
  const limit = row.emissoes_limite ?? 0
  const exced = row.preco_excedente_brl ?? 0

  if (limit > 0 && exced > 0) return `${limit} notas/mês · ${BRL.format(exced)} por nota excedente`
  if (limit > 0)              return `${limit} notas/mês`
  if (exced > 0)              return `${BRL.format(exced)} por nota emitida em produção`
  return ''
}

function mergePlan(meta: PricingPlanMeta, row: PlanoRow | undefined): PricingPlan {
  if (!row) {
    return {
      key:          meta.key,
      persona:      meta.persona,
      name:         meta.dbName,
      description:  meta.fallback.description,
      priceLabel:   meta.fallback.priceLabel,
      notes:        meta.fallback.notes,
      bullets:      meta.bullets,
      primaryCta:   meta.primaryCta,
      secondaryCta: meta.secondaryCta,
      badge:        meta.badge,
      highlight:    meta.highlight,
    }
  }
  return {
    key:          meta.key,
    persona:      meta.persona,
    name:         row.nome,
    description:  row.descricao_curta ?? meta.fallback.description,
    priceLabel:   formatPriceLabel(row),
    notes:        formatNotes(row),
    bullets:      meta.bullets,
    primaryCta:   meta.primaryCta,
    secondaryCta: meta.secondaryCta,
    badge:        meta.badge,
    highlight:    meta.highlight,
  }
}

/**
 * Lê os 3 planos âncora do banco e devolve `PricingPlan[]` pronto pra render.
 *
 * Server-side only — usa createAdminClient pra bypass RLS (apesar de planos
 * ter policy pública de SELECT, manter consistente com /admin).
 */
export async function getAnchorPlans(): Promise<PricingPlan[]> {
  const names = ANCHOR_PLAN_META.map(m => m.dbName)
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('planos')
      .select('nome, descricao_curta, preco_mensal_brl, preco_excedente_brl, emissoes_limite')
      .in('nome', names)
    if (error) throw error

    const rows = (data ?? []) as PlanoRow[]
    const byName = new Map(rows.map(r => [r.nome, r]))
    return ANCHOR_PLAN_META.map(meta => mergePlan(meta, byName.get(meta.dbName)))
  } catch {
    // Banco indisponível: render com fallback congelado pra não quebrar a home.
    return ANCHOR_PLAN_META.map(meta => mergePlan(meta, undefined))
  }
}
