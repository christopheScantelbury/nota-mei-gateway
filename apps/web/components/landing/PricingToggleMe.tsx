'use client'

// PricingToggleMe — todos os planos ME/EPP completos para a página /me.
// Espelha o padrão PricingToggleMei: 4 cards específicos da persona + toggle
// mensal/anual com 20% off.
//
// Antes deste componente, /me usava PricingSection (3 cards âncora 1 por persona),
// inconsistente com /mei que mostrava todos os 4 planos MEI.

import { useState } from 'react'
import Link from 'next/link'
import { formatBRL as brl } from '@/lib/format'

const DISCOUNT = 0.8 // 20% off anual

type Plan = {
  name: string
  monthlyPrice: number | null // null = Enterprise (sob consulta)
  priceLabel: string
  period: string
  limit: string
  desc: string
  extra: string | null
  cta: string
  ctaHref: string
  highlight: boolean
  badge?: string
}

const PLANS: Plan[] = [
  {
    name: 'Trial ME',
    monthlyPrice: null,
    priceLabel: 'Grátis',
    period: '5 notas',
    limit: 'Sem compromisso',
    desc: 'Pra experimentar sem cadastrar cartão.',
    extra: null,
    cta: 'Começar grátis',
    ctaHref: '/cadastro/me?plano=trial',
    highlight: false,
    badge: '5 notas pra testar',
  },
  {
    name: 'ME Start',
    monthlyPrice: 59.99,
    priceLabel: 'R$ 59,99',
    period: '/mês',
    limit: '10 notas/mês',
    desc: 'Para Microempresa começando com NFS-e Nacional.',
    extra: 'R$ 0,80 por nota acima do limite',
    cta: 'Assinar Start',
    ctaHref: '/cadastro/me?plano=start',
    highlight: false,
  },
  {
    name: 'ME Pro',
    monthlyPrice: 149.9,
    priceLabel: 'R$ 149,90',
    period: '/mês',
    limit: '50 notas/mês',
    desc: 'Para ME com fluxo regular e multi-cliente.',
    extra: 'R$ 0,60 por nota acima do limite',
    cta: 'Assinar Pro',
    ctaHref: '/cadastro/me?plano=pro',
    highlight: true,
  },
  {
    name: 'ME Business',
    monthlyPrice: 299.9,
    priceLabel: 'R$ 299,90',
    period: '/mês',
    limit: '300 notas/mês',
    desc: 'Para ME/EPP estabelecidas com alta emissão.',
    extra: 'R$ 0,40 por nota acima do limite',
    cta: 'Assinar Business',
    ctaHref: '/cadastro/me?plano=business',
    highlight: false,
  },
  {
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
  },
]

export default function PricingToggleMe() {
  const [annual, setAnnual] = useState(false)

  return (
    <div>
      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-semibold transition ${!annual ? 'text-text-1' : 'text-text-2'}`}>
          Mensal
        </span>
        <button
          type="button"
          onClick={() => setAnnual((v) => !v)}
          aria-label="Alternar cobrança mensal e anual"
          className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan ${
            annual ? 'bg-brand-cyan' : 'bg-navy-600'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              annual ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={`text-sm font-semibold transition ${annual ? 'text-text-1' : 'text-text-2'}`}>
          Anual{' '}
          <span className="ml-1 text-xs font-bold text-nota-autorizada bg-nota-autorizada/10 border border-nota-autorizada/20 px-1.5 py-0.5 rounded-full">
            −20%
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const annualMonthly =
            plan.monthlyPrice !== null ? Math.round(plan.monthlyPrice * DISCOUNT * 100) / 100 : null
          const annualTotal = annualMonthly !== null ? annualMonthly * 12 : null
          const showAnnual = annual && annualMonthly !== null

          const displayPrice = showAnnual ? brl(annualMonthly!) : plan.priceLabel
          const displayPeriod = showAnnual ? '/mês' : plan.period
          const annualNote =
            showAnnual && annualTotal !== null ? `${brl(annualTotal)}/ano · cobrado anualmente` : null

          const ciclo = annual && plan.monthlyPrice !== null ? '&ciclo=anual' : ''
          const href = plan.ctaHref + ciclo

          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border flex flex-col gap-4 transition-shadow hover:shadow-lg ${
                plan.highlight
                  ? 'bg-brand-cyan/5 border-brand-cyan ring-1 ring-brand-cyan dark:bg-brand-cyan/10'
                  : 'bg-navy-700 border-navy-600'
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-bold text-brand-cyan bg-brand-cyan/15 px-2 py-0.5 rounded-full self-start">
                  Mais popular
                </span>
              )}
              {!plan.highlight && plan.badge && (
                <span className="text-xs font-semibold text-nota-autorizada bg-nota-autorizada/10 border border-nota-autorizada/20 px-2 py-0.5 rounded-full self-start">
                  {plan.badge}
                </span>
              )}
              <div>
                <p className="font-display font-extrabold text-lg text-text-1">{plan.name}</p>
                <p className="text-text-2 text-xs mt-1">{plan.desc}</p>
              </div>
              <div>
                <span className="font-display text-3xl font-extrabold text-text-1">{displayPrice}</span>
                {displayPeriod && <span className="text-text-2 text-sm"> {displayPeriod}</span>}
                {annualNote && <p className="text-text-2 text-xs mt-1">{annualNote}</p>}
              </div>
              <p className="text-brand-blue dark:text-brand-cyan text-sm font-semibold">{plan.limit}</p>
              {plan.extra && <p className="text-text-2 text-xs">{plan.extra}</p>}
              <Link
                href={href}
                className={`mt-auto text-center text-sm font-semibold py-2.5 rounded-lg transition ${
                  plan.highlight
                    ? 'bg-brand-cyan text-white dark:text-[#0A0F1E] hover:opacity-90'
                    : 'border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-blue dark:hover:text-brand-cyan'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          )
        })}
      </div>

      <p className="mt-8 text-center text-sm text-text-2">
        Trial de 30 dias sem cartão · Cancele quando quiser · Simples Nacional, Lucro Presumido e Lucro Real
      </p>
    </div>
  )
}
