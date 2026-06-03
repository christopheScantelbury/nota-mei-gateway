'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatBRL as brl } from '@/lib/format'

const DISCOUNT = 0.8  // 20% off anual

type Plan = {
  name: string
  monthlyPrice: number | null  // null = Scale (sob consulta)
  priceLabel: string
  period: string
  limit: string
  desc: string
  extra: string | null
  cta: string
  ctaHref: string
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Dev',
    monthlyPrice: 59,
    priceLabel: 'R$ 59',
    period: '/mês',
    limit: '200 notas + sandbox',
    desc: 'Desenvolvedor solo, prototipagem e MVPs.',
    extra: 'R$ 0,50 por nota acima do limite',
    cta: 'Criar conta de teste',
    ctaHref: '/cadastro/dev&plano=dev',
    highlight: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 119,
    priceLabel: 'R$ 119',
    period: '/mês',
    limit: '500 notas/mês',
    desc: 'Agências e pequenos SaaS em produção.',
    extra: 'R$ 0,35 por nota acima do limite',
    cta: 'Assinar Pro',
    ctaHref: '/cadastro/dev&plano=pro',
    highlight: true,
  },
  {
    name: 'Business',
    monthlyPrice: 249,
    priceLabel: 'R$ 249',
    period: '/mês',
    limit: '2.000 notas/mês',
    desc: 'Plataformas e marketplaces estabelecidos.',
    extra: 'R$ 0,20 por nota acima do limite',
    cta: 'Assinar Business',
    ctaHref: '/cadastro/dev&plano=business',
    highlight: false,
  },
  {
    name: 'Scale',
    monthlyPrice: null,
    priceLabel: 'Sob consulta',
    period: '',
    limit: '10.000+ notas/mês',
    desc: 'High volume, SLA dedicado, suporte prioritário.',
    extra: null,
    cta: 'Falar com vendas',
    ctaHref: 'mailto:vendas@emitirnotafacil.com.br',
    highlight: false,
  },
]

export default function PricingToggleGateway() {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

          const ciclo = annual && plan.monthlyPrice !== null ? '&ciclo=anual' : ''
          const href  = plan.ctaHref + ciclo

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
                {displayPeriod && (
                  <span className="text-text-2 text-sm"> {displayPeriod}</span>
                )}
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
