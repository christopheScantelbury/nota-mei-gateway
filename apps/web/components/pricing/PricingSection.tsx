'use client'

import { useEffect, useRef } from 'react'
import { ANCHOR_PLANS } from '@/data/pricing'
import PricingCard from './PricingCard'
import { trackPricingView } from '@/lib/analytics/events'

/**
 * Seção "Planos e preços" da home — dark-first (herda bg-navy-900 do main).
 *
 * Spec: HIST-2.1.
 */
export default function PricingSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let fired = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.some(e => e.isIntersecting)
      if (visible && !fired) {
        timer = setTimeout(() => {
          if (fired) return
          fired = true
          trackPricingView({ persona_focus: 'me' })
        }, 1000)
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => { obs.disconnect(); if (timer) clearTimeout(timer) }
  }, [])

  return (
    <section id="precos" className="py-16 md:py-24 px-4" ref={ref}>
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-extrabold text-text-1">
            Planos e preços
          </h2>
          <p className="mt-4 text-text-2 max-w-2xl mx-auto">
            Um plano para cada perfil. Comece grátis. Escale conforme cresce.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {ANCHOR_PLANS.map((plan) => (
            <PricingCard key={plan.key} plan={plan} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-text-2">
          Trial de 30 dias sem cartão. Cancele quando quiser.
        </p>
      </div>
    </section>
  )
}
