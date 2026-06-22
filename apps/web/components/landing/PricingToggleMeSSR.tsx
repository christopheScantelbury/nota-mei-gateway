/**
 * Wrapper SSR — busca planos ME/EPP direto do banco e passa pro client.
 *
 * Mesmo pattern do PricingToggleMeiSSR. Mantém EPP Scale como item
 * fixo no fim (não vem do banco — é card de "sob consulta").
 */
import { createAdminClient } from '@/lib/supabase/admin'
import PricingToggleMe, { type Plan } from './PricingToggleMe'

interface PlanoRow {
  nome: string
  preco_mensal_brl: number | null
  preco_excedente_brl: number | null
  emissoes_limite: number
  descricao_curta: string | null
  destaque: boolean
  ordem_exibicao: number
}

const EPP_SCALE_FIXED: Plan = {
  name: 'EPP Scale',
  monthlyPrice: null,
  priceLabel: 'Sob consulta',
  period: '',
  limit: '300+ notas/mês',
  desc: 'EPP com volume alto + multi-empresa + SLA dedicado.',
  extra: null,
  cta: 'Falar com vendas',
  ctaHref: 'mailto:vendas@emitirnotafacil.com.br?subject=EPP Scale - Cotação',
  highlight: false,
}

function toPlan(p: PlanoRow): Plan {
  const isTrial = /trial/i.test(p.nome)
  // CTA slug pra href cadastro
  const slug = p.nome.toLowerCase().replace(/^me\s+/, '').replace(/\s+/g, '-')

  let priceLabel = 'Grátis'
  let period = ''
  let monthlyPrice: number | null = null

  if (isTrial) {
    priceLabel = 'Grátis'
    period = `${p.emissoes_limite} notas`
  } else if (p.preco_mensal_brl) {
    priceLabel = `R$ ${p.preco_mensal_brl.toFixed(2).replace('.', ',')}`
    period = '/mês'
    monthlyPrice = p.preco_mensal_brl
  }

  const limit = isTrial ? 'Sem compromisso' : `${p.emissoes_limite} notas/mês`
  const extra =
    !isTrial && p.preco_excedente_brl && p.preco_excedente_brl > 0
      ? `R$ ${p.preco_excedente_brl.toFixed(2).replace('.', ',')} por nota acima do limite`
      : null

  const shortName = p.nome.replace(/^ME\s+/, '')
  return {
    name: p.nome,
    monthlyPrice,
    priceLabel,
    period,
    limit,
    desc: p.descricao_curta ?? '',
    extra,
    cta: isTrial ? 'Começar grátis' : `Assinar ${shortName}`,
    ctaHref: isTrial ? '/cadastro/me?plano=trial' : `/cadastro/me?plano=${slug}`,
    highlight: p.destaque,
    badge: isTrial ? `${p.emissoes_limite} notas pra testar` : undefined,
  }
}

export default async function PricingToggleMeSSR() {
  const admin = createAdminClient()
  const { data: planos } = await admin
    .from('planos')
    .select('nome, preco_mensal_brl, preco_excedente_brl, emissoes_limite, descricao_curta, destaque, ordem_exibicao')
    .eq('ativo', true)
    .in('tipo_empresa', ['ME', 'EPP'])
    .order('ordem_exibicao', { ascending: true })
    .returns<PlanoRow[]>()

  const dbPlans = (planos ?? []).map(toPlan)
  // EPP Scale fica no fim como card fixo (não vem do banco).
  const plans = dbPlans.length > 0 ? [...dbPlans, EPP_SCALE_FIXED] : undefined

  return <PricingToggleMe plans={plans} />
}
