'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatBRL as brl } from '@/lib/format'

const DISCOUNT = 0.8  // 20% off anual

type Plan = {
  name: string
  monthlyPrice: number | null  // null = preço fixo (Trial, Avulso)
  priceLabel: string
  period: string
  limit: string
  desc: string
  extra: string | null
  cta: string
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Trial',
    monthlyPrice: null,
    priceLabel: 'Grátis',
    period: '30 dias',
    limit: '5 notas no trial',
    desc: 'Para experimentar sem compromisso.',
    extra: null,
    cta: 'Começar grátis',
    highlight: false,
  },
  {
    name: 'Avulso',
    monthlyPrice: null,
    priceLabel: 'R$ 2,90',
    period: '/nota',
    limit: 'Sem mensalidade',
    desc: 'Para quem emite pouco ou de forma esporádica.',
    extra: 'R$ 2,90 por nota',
    cta: 'Emitir nota',
    highlight: false,
  },
  {
    name: 'MEI Mensal',
    monthlyPrice: 19,
    priceLabel: 'R$ 19',
    period: '/mês',
    limit: '30 notas/mês',
    desc: 'Para quem emite todo mês com regularidade.',
    extra: 'R$ 0,80 por nota acima do limite',
    cta: 'Assinar agora',
    highlight: true,
  },
  {
    name: 'MEI Plus',
    monthlyPrice: 39,
    priceLabel: 'R$ 39',
    period: '/mês',
    limit: '100 notas/mês',
    desc: 'Para MEI com fluxo regular de serviços.',
    extra: 'R$ 0,50 por nota acima do limite',
    cta: 'Assinar agora',
    highlight: false,
  },
]

export default function PricingToggleMei() {
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
          onClick={() => setAnnual(v => !v)}
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => {
          const annualMonthly = plan.monthlyPrice !== null
            ? Math.round(plan.monthlyPrice * DISCOUNT * 100) / 100
            : null
          const annualTotal   = annualMonthly !== null ? annualMonthly * 12 : null
          const showAnnual    = annual && annualMonthly !== null

          const displayPrice  = showAnnual ? brl(annualMonthly!) : plan.priceLabel
          const displayPeriod = showAnnual ? '/mês' : plan.period
          const annualNote    = showAnnual && annualTotal !== null
            ? `${brl(annualTotal)}/ano · cobrado anualmente`
            : null

          const slug  = plan.name.toLowerCase().replace(' ', '-')
          const ciclo = annual && plan.monthlyPrice !== null ? '&ciclo=anual' : ''
          const href  = `/cadastro?produto=mei&plano=${slug}${ciclo}`

          return (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 border flex flex-col gap-4 ${
                plan.highlight
                  ? 'bg-brand-cyan/10 border-brand-cyan ring-1 ring-brand-cyan'
                  : 'bg-navy-700 border-navy-600'
              }`}
            >
              {plan.highlight && (
                <span className="text-xs font-bold text-brand-cyan bg-brand-cyan/20 px-2 py-0.5 rounded-full self-start">
                  Mais popular
                </span>
              )}
              <div>
                <p className="font-display font-extrabold text-lg">{plan.name}</p>
                <p className="text-text-2 text-xs mt-1">{plan.desc}</p>
              </div>
              <div>
                <span className="font-display text-3xl font-extrabold">{displayPrice}</span>
                <span className="text-text-2 text-sm"> {displayPeriod}</span>
                {annualNote && (
                  <p className="text-text-2 text-xs mt-1">{annualNote}</p>
                )}
              </div>
              <p className="text-brand-cyan text-sm font-semibold">{plan.limit}</p>
              {plan.extra && <p className="text-text-2 text-xs">{plan.extra}</p>}
              <Link
                href={href}
                className={`mt-auto text-center text-sm font-semibold py-2.5 rounded-lg transition ${
                  plan.highlight
                    ? 'bg-brand-cyan text-navy-900 dark:text-[#0A0F1E] hover:opacity-90'
                    : 'border border-navy-600 text-text-1 hover:border-brand-cyan'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
