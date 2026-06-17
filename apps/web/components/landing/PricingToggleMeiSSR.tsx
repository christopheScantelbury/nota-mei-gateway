/**
 * Wrapper SSR — busca planos MEI direto do banco e passa pro client component.
 *
 * Antes (2026-06-17): cards hardcoded em PricingToggleMei → mudanças via
 * /admin/planos não refletiam na landing. Reportado pelo Chris (MEI Plus
 * editado pra 30 notas mas landing seguia 15).
 *
 * Agora: SSR fetch via admin client (RLS de planos é leitura pública pra
 * planos.ativo=true, então anon poderia ler — usamos service role pra
 * pegar campos extras como descricao_curta/destaque/ordem_exibicao).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import PricingToggleMei, { type Plan } from './PricingToggleMei'

interface PlanoRow {
  nome: string
  preco_mensal_brl: number | null
  preco_excedente_brl: number | null
  emissoes_limite: number
  descricao_curta: string | null
  destaque: boolean
  ordem_exibicao: number
}

function toPlan(p: PlanoRow): Plan {
  // Normaliza nome pra display (remove prefixo "MEI ").
  const displayName = p.nome.replace(/^MEI\s+/, '').replace(/\s+MEI$/, '')
  const isTrial = /trial/i.test(p.nome)
  const isAvulso = /avulso/i.test(p.nome) || (p.preco_mensal_brl == null || p.preco_mensal_brl === 0) && (p.preco_excedente_brl ?? 0) > 0 && !isTrial

  // Preço label + período conforme o tipo
  let priceLabel = 'Grátis'
  let period = isTrial ? `${p.emissoes_limite} notas` : ''
  let monthlyPrice: number | null = null

  if (isTrial) {
    priceLabel = 'Grátis'
    period = `${p.emissoes_limite} notas`
  } else if (isAvulso && p.preco_excedente_brl) {
    priceLabel = `R$ ${p.preco_excedente_brl.toFixed(2).replace('.', ',')}`
    period = '/nota'
  } else if (p.preco_mensal_brl) {
    priceLabel = `R$ ${p.preco_mensal_brl.toFixed(2).replace('.', ',')}`
    period = '/mês'
    monthlyPrice = p.preco_mensal_brl
  }

  // Limit text
  let limit = ''
  if (isTrial) {
    limit = 'Sem compromisso'
  } else if (isAvulso) {
    limit = 'Sem mensalidade'
  } else {
    limit = `${p.emissoes_limite} notas/mês`
  }

  // Extra (preço por nota excedente, ou cobrança quando emite)
  let extra: string | null = null
  if (isAvulso) {
    extra = 'Cobrança só quando emitir'
  } else if (!isTrial && p.preco_excedente_brl && p.preco_excedente_brl > 0) {
    extra = `R$ ${p.preco_excedente_brl.toFixed(2).replace('.', ',')} por nota acima do limite`
  }

  // CTA
  const cta = isTrial ? 'Começar grátis' : isAvulso ? 'Emitir nota' : 'Assinar agora'

  return {
    name: displayName,
    monthlyPrice,
    priceLabel,
    period,
    limit,
    desc: p.descricao_curta ?? '',
    extra,
    cta,
    highlight: p.destaque,
  }
}

export default async function PricingToggleMeiSSR() {
  const admin = createAdminClient()
  const { data: planos } = await admin
    .from('planos')
    .select('nome, preco_mensal_brl, preco_excedente_brl, emissoes_limite, descricao_curta, destaque, ordem_exibicao')
    .eq('ativo', true)
    .eq('tipo_empresa', 'MEI')
    .order('ordem_exibicao', { ascending: true })
    .returns<PlanoRow[]>()

  // Se banco vazio (deveria ter os 5 planos MEI seedados), fallback pra
  // array hardcoded do PricingToggleMei via prop undefined.
  const plans = planos && planos.length > 0 ? planos.map(toPlan) : undefined

  return <PricingToggleMei plans={plans} />
}
