'use client'

import { useState } from 'react'
import Link from 'next/link'

const planosMEI = [
  {
    name: 'Avulso',
    price: 'R$ 2,90',
    period: '/nota',
    limit: 'Sem mensalidade',
    description: 'Emita quando precisar, sem compromisso mensal.',
    context: 'Ideal para MEI que emite notas esporadicamente.',
    cta: 'Emitir nota avulsa',
    href: '/cadastro?produto=mei&plano=avulso',
    highlight: false,
  },
  {
    name: 'MEI Mensal',
    price: 'R$ 19',
    period: '/mês',
    limit: '30 notas/mês',
    description: 'Para MEI com clientes fixos todo mês.',
    context: 'Ideal para MEI que emite notas todo mês.',
    cta: 'Assinar MEI Mensal',
    href: '/cadastro?produto=mei&plano=mensal',
    highlight: false,
  },
  {
    name: 'MEI Plus',
    price: 'R$ 39',
    period: '/mês',
    limit: '100 notas/mês',
    description: 'Sem limite no dia a dia do MEI ativo.',
    context: 'Ideal para MEI que emite nota toda semana.',
    cta: 'Assinar MEI Plus',
    href: '/cadastro?produto=mei&plano=plus',
    highlight: true,
  },
]

const planosAPI = [
  {
    name: 'Trial',
    price: 'Grátis',
    period: '30 dias',
    limit: '5 notas no trial',
    description: 'Para experimentar sem compromisso.',
    context: null,
    cta: 'Começar grátis',
    href: '/cadastro?produto=gateway',
    highlight: false,
  },
  {
    name: 'Starter',
    price: 'R$ 29',
    period: '/mês',
    limit: '50 notas/mês',
    description: 'Para freelancers com baixo volume.',
    context: null,
    cta: 'Assinar Starter',
    href: '/cadastro?produto=gateway&plano=starter',
    highlight: false,
  },
  {
    name: 'Basic',
    price: 'R$ 59',
    period: '/mês',
    limit: '200 notas/mês',
    description: 'Para SaaS e MVPs em produção.',
    context: null,
    cta: 'Assinar Basic',
    href: '/cadastro?produto=gateway&plano=basic',
    highlight: true,
  },
  {
    name: 'Pro',
    price: 'R$ 119',
    period: '/mês',
    limit: '500 notas/mês',
    description: 'Para agências e plataformas em crescimento.',
    context: null,
    cta: 'Assinar Pro',
    href: '/cadastro?produto=gateway&plano=pro',
    highlight: false,
  },
  {
    name: 'Business',
    price: 'R$ 249',
    period: '/mês',
    limit: '2.000 notas/mês',
    description: 'Para alto volume e múltiplos clientes.',
    context: null,
    cta: 'Assinar Business',
    href: '/cadastro?produto=gateway&plano=business',
    highlight: false,
  },
]

export default function PricingToggle() {
  const [tab, setTab] = useState<'mei' | 'dev'>('mei')
  const planos = tab === 'mei' ? planosMEI : planosAPI

  return (
    <>
      {/* Toggle */}
      <div className="flex rounded-xl border border-navy-600 p-1 w-fit mx-auto mb-12 bg-navy-900">
        <button
          onClick={() => setTab('mei')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'mei'
              ? 'bg-brand-cyan text-navy-900'
              : 'text-text-2 hover:text-text-1'
          }`}
        >
          📱 Sou MEI
        </button>
        <button
          onClick={() => setTab('dev')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'dev'
              ? 'bg-brand-cyan text-navy-900'
              : 'text-text-2 hover:text-text-1'
          }`}
        >
          {'</>'} Sou dev
        </button>
      </div>

      {/* Plans grid */}
      <div className={`grid gap-4 ${tab === 'mei' ? 'grid-cols-1 sm:grid-cols-3 max-w-3xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'}`}>
        {planos.map((plan) => (
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
              <p className="text-text-2 text-xs mt-1">{plan.description}</p>
            </div>
            <div>
              <span className="font-display text-3xl font-extrabold">{plan.price}</span>
              <span className="text-text-2 text-sm">{plan.period}</span>
            </div>
            <p className="text-brand-cyan text-sm font-semibold">{plan.limit}</p>
            {plan.context && (
              <p className="text-text-2 text-xs">{plan.context}</p>
            )}
            <Link
              href={plan.href}
              className={`mt-auto text-center text-sm font-semibold py-2.5 rounded-lg transition ${
                plan.highlight
                  ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
                  : 'border border-navy-600 text-text-1 hover:border-brand-cyan'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {tab === 'dev' && (
        <p className="text-center text-text-2 text-xs mt-6">
          Sandbox sempre incluso · Trial de 30 dias sem cartão · Excedentes cobrados por nota
        </p>
      )}
    </>
  )
}
