'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

// ── Animated counter ─────────────────────────────────────────────────────────
// Initial state = target so SSR renders the correct value.
// Animation resets to 0 after mount (useEffect runs client-only).
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(target)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()
  const animated = useRef(false)

  useEffect(() => {
    if (!inView || reduced || animated.current) return
    animated.current = true
    let start = 0
    setValue(0)
    const duration = 1200
    const step = 16
    const increment = target / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setValue(target)
        clearInterval(timer)
      } else {
        setValue(Math.floor(start))
      }
    }, step)
    return () => clearInterval(timer)
  }, [inView, target, reduced])

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  )
}

const securityItems = [
  { icon: '🔒', label: 'Certificado A1 nunca em disco', desc: 'Armazenado e decriptado em memória via AWS Secrets Manager' },
  { icon: '🛡️', label: 'API Keys hasheadas (SHA-256)',  desc: 'A chave real nunca é armazenada no banco de dados' },
  { icon: '⚖️', label: 'Conforme LGPD',                desc: 'Dados processados exclusivamente no território nacional' },
  { icon: '🔐', label: 'mTLS com a Receita Federal',   desc: 'Conexão mutuamente autenticada com o serviço federal' },
]

export default function SocialProof() {
  return (
    <section className="py-20 px-4 border-y border-navy-600 bg-navy-700/20">
      <div className="mx-auto max-w-5xl flex flex-col gap-16">

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-6 text-center">
          {[
            { value: 3,    suffix: 's',  label: 'tempo médio de emissão',  prefix: '< ' },
            { value: 99,   suffix: '.9%', label: 'uptime SLA',              prefix: ''   },
            { value: 5000, suffix: '+',  label: 'municípios suportados',   prefix: ''   },
          ].map(({ value, suffix, label, prefix }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="font-display text-4xl font-extrabold text-brand-cyan">
                {prefix}
                <Counter target={value} suffix={suffix} />
              </span>
              <span className="text-text-2 text-sm">{label}</span>
            </div>
          ))}
        </div>

        {/* Segurança / LGPD */}
        <div>
          <p className="text-center text-text-2 text-xs font-semibold uppercase tracking-widest mb-6">
            Segurança &amp; Conformidade
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {securityItems.map(({ icon, label, desc }) => (
              <div
                key={label}
                className="flex gap-4 bg-navy-700 border border-navy-600 rounded-xl p-4"
              >
                <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="font-semibold text-sm text-text-1">{label}</p>
                  <p className="text-text-2 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
