'use client'

import Link from 'next/link'
import type { PricingPlan } from '@/lib/pricing/types'
import { trackCtaClick, type CtaLocation } from '@/lib/analytics/events'

/**
 * Card individual do PricingSection — dark-first (landing usa bg-navy-900).
 * Card com `highlight: true` recebe:
 * - Border 2px amber + sombra amarelada
 * - Badge superior
 * - Order-first no mobile pra aparecer primeiro
 *
 * Spec: HIST-2.1/2.2/2.3.
 */
interface Props {
  plan: PricingPlan
  className?: string
}

export default function PricingCard({ plan, className = '' }: Props) {
  const location: CtaLocation = `pricing_card_${plan.persona}` as CtaLocation

  const cardCls = plan.highlight
    ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-500/10 to-navy-700 shadow-xl shadow-amber-500/20'
    : 'border border-navy-600 bg-navy-700'

  const ctaCls = plan.highlight
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : 'bg-brand-cyan hover:opacity-90 text-navy-900'

  // No mobile, card highlight aparece primeiro
  const orderCls = plan.highlight ? 'order-first md:order-none' : ''

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 sm:p-7 ${cardCls} ${orderCls} ${className}`}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center text-[11px] font-semibold bg-amber-500 text-white px-3 py-1 rounded-full whitespace-nowrap shadow-md">
          {plan.badge}
        </span>
      )}

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider font-semibold text-text-2 mb-1">
          {plan.persona === 'mei' ? 'MEI' : plan.persona === 'me' ? 'ME / EPP' : 'Desenvolvedor'}
        </p>
        <h3 className="font-display text-xl font-extrabold text-text-1">
          {plan.name}
        </h3>
        <p className="text-sm text-text-2 mt-1">{plan.description}</p>
      </div>

      <div className="mb-5">
        <p className="font-display text-3xl font-extrabold text-text-1 leading-none">
          {plan.priceLabel}
        </p>
        <p className="text-xs text-text-2 mt-1.5">{plan.notes}</p>
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-text-1">
            <span aria-hidden className="text-brand-cyan font-bold shrink-0 mt-0.5">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link
          href={plan.primaryCta.href}
          onClick={() => trackCtaClick({ persona: plan.persona, location, plan: plan.key })}
          className={`block text-center text-sm font-semibold px-5 py-3 rounded-lg transition ${ctaCls}`}
        >
          {plan.primaryCta.label}
        </Link>
        {plan.secondaryCta && (
          <Link
            href={plan.secondaryCta.href}
            onClick={() =>
              trackCtaClick({ persona: plan.persona, location, plan: `${plan.key}_secondary` })
            }
            className="block text-center text-xs text-text-2 hover:text-text-1 transition"
          >
            {plan.secondaryCta.label}
          </Link>
        )}
      </div>
    </div>
  )
}
