'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

// ── Animated counter ─────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!inView || reduced) {
      setValue(target)
      return
    }
    let start = 0
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

// ── Infra logo pill ──────────────────────────────────────────────────────────
function InfraPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 bg-navy-700 border border-navy-600 rounded-full px-4 py-2 text-sm font-semibold text-text-2"
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      {name}
    </span>
  )
}

const infraStack = [
  { name: 'Supabase',   color: '#3ECF8E' },
  { name: 'Railway',    color: '#7C3AED' },
  { name: 'AWS KMS',    color: '#FF9900' },
  { name: 'Stripe',     color: '#635BFF' },
  { name: 'RabbitMQ',   color: '#FF6600' },
  { name: 'Vercel',     color: '#FFFFFF' },
  { name: 'Prometheus', color: '#E6522C' },
]

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
            { value: 2,    suffix: 's',  label: 'tempo médio de emissão',  prefix: '< ' },
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

        {/* Logos de infraestrutura */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-text-2 text-xs font-semibold uppercase tracking-widest">
            Infraestrutura de nível enterprise
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {infraStack.map((s) => (
              <InfraPill key={s.name} {...s} />
            ))}
          </div>
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
