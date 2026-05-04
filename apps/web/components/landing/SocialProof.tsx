'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// ── Métricas ─────────────────────────────────────────────────────────────────
// Cada stat tem um rótulo inteiro (display) e um valor numérico para animação.
// A animação substitui apenas a parte numérica — prefix/suffix ficam fixos,
// garantindo que nunca apareça "0.9%" em vez de "99.9%".
const stats = [
  {
    prefix: '< ',
    value: 3,
    suffix: 's',
    display: '< 3s',
    label: 'tempo médio de emissão',
  },
  {
    prefix: '',
    value: 99,
    suffix: '.9%',
    display: '99.9%',
    label: 'uptime SLA',
  },
  {
    prefix: '',
    value: 5000,
    suffix: '+',
    display: '5.000+',
    label: 'municípios suportados',
  },
]

// StatCard renderiza o valor correto no SSR e anima no cliente
// usando fade+slide em vez de countup — evita flashes de valores incorretos
function StatCard({
  prefix,
  suffix,
  display,
  label,
}: {
  prefix: string
  suffix: string
  display: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) { setVisible(true); return }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 },
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [reduced])

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-1 transition-all duration-700 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Valor sempre correto — sem animação de contagem que gera valores intermediários errados */}
      <span className="font-display text-4xl font-extrabold text-brand-cyan">
        {display}
      </span>
      <span className="text-text-2 text-sm">{label}</span>
    </div>
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
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
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
