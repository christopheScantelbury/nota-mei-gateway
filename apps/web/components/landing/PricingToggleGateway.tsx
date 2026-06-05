'use client'

// PricingToggleGateway — pay-per-use, alinhado com a home root (`/`) que
// descreve o produto Dev como "Grátis · pague por uso · R$ 0,89 por nota".
//
// Antes deste rewrite, mostrava planos mensais R$59/R$119/R$249 — inconsistente
// com a página inicial. Decisão de produto reforçada na rodada UX 2026-06-04:
// dev integrador prefere zero compromisso fixo e cobrança proporcional ao
// uso real em produção, sandbox sempre grátis pra prototipar.

import Link from 'next/link'

type Tier = {
  name: string
  priceLabel: string
  priceSub: string | null
  pitch: string
  features: string[]
  cta: string
  ctaHref: string
  highlight: boolean
  badge?: string
}

const TIERS: Tier[] = [
  {
    name: 'Sandbox',
    priceLabel: 'Grátis',
    priceSub: 'sem cadastro',
    pitch: 'Para prototipar e testar a integração antes de qualquer compromisso.',
    features: [
      'Ambiente de homologação ilimitado',
      'Mesma API e webhooks da produção',
      'SDKs Node, Python e PHP',
      'Sem cartão · sem expiração',
    ],
    cta: 'Testar agora',
    ctaHref: '/sandbox',
    highlight: false,
  },
  {
    name: 'Pay-as-you-go',
    priceLabel: 'R$ 0,89',
    priceSub: 'por nota emitida',
    pitch: 'Você paga só pelo que emite em produção. Sem mensalidade, sem mínimo.',
    features: [
      'Sem mensalidade · só cobra o que emite',
      'Trial de 30 dias com 5 notas grátis',
      'Webhooks HMAC-SHA256 com retry',
      'Dashboard, logs e auditoria fiscal 5 anos',
      'Suporte por e-mail em até 24h',
    ],
    cta: 'Criar conta de produção',
    ctaHref: '/cadastro/dev?plano=payg',
    highlight: true,
    badge: 'Mais escolhido',
  },
  {
    name: 'Enterprise',
    priceLabel: 'Sob consulta',
    priceSub: null,
    pitch: 'Para alto volume, SLA dedicado e integração assistida.',
    features: [
      'Preço por nota com desconto progressivo',
      'SLA 99.95% com suporte 24/7',
      'Múltiplas API Keys e ambientes isolados',
      'Onboarding e integração assistida',
      'Contrato anual com NF-e',
    ],
    cta: 'Falar com vendas',
    ctaHref: 'mailto:vendas@emitirnotafacil.com.br?subject=Enterprise%20Gateway',
    highlight: false,
  },
]

export default function PricingToggleGateway() {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-6xl mx-auto">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl p-6 border flex flex-col gap-4 transition-shadow hover:shadow-lg ${
              tier.highlight
                ? 'bg-persona-api/5 border-persona-api ring-1 ring-persona-api dark:bg-persona-api/10'
                : 'bg-navy-700 border-navy-600'
            }`}
          >
            {tier.badge && (
              <span className="text-xs font-bold text-persona-api bg-persona-api/15 px-2 py-0.5 rounded-full self-start">
                {tier.badge}
              </span>
            )}

            <div>
              <p className="font-display font-extrabold text-lg text-text-1">{tier.name}</p>
              <p className="text-text-2 text-xs mt-1">{tier.pitch}</p>
            </div>

            <div>
              <span className="font-display text-3xl font-extrabold text-text-1">{tier.priceLabel}</span>
              {tier.priceSub && (
                <span className="text-text-2 text-sm"> · {tier.priceSub}</span>
              )}
            </div>

            <ul className="flex flex-col gap-2 text-sm text-text-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-persona-api font-bold mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={`mt-auto text-center text-sm font-semibold py-2.5 rounded-lg transition ${
                tier.highlight
                  ? 'bg-persona-api text-white hover:opacity-90'
                  : 'border border-navy-600 text-text-1 hover:border-persona-api hover:text-persona-api'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-text-2">
        Sandbox sempre incluso · Trial 30 dias com 5 notas · Sem fidelidade
      </p>
    </div>
  )
}
