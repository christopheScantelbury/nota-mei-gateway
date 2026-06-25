'use client'

import { useEffect, useRef } from 'react'
import { trackPricingView } from '@/lib/analytics/events'

/**
 * Wrapper client invisível em volta dos cards do PricingSection. Só existe
 * pra observar a entrada na viewport e disparar `pricing_view` 1×.
 * Mantido em arquivo separado pra PricingSection continuar Server Component
 * (que precisa pra fazer SELECT no banco no momento do render).
 */
export default function PricingViewTracker({ children }: { children: React.ReactNode }) {
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

  return <div ref={ref}>{children}</div>
}
