'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: 'easeOut' as const, delay },
})

export default function HeroSection() {
  const reduced = useReducedMotion()

  if (reduced) {
    return <HeroContent />
  }

  return (
    <section className="pt-32 pb-24 px-4 text-center">
      <div className="mx-auto max-w-3xl">
        <motion.span
          {...fadeUp(0)}
          className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-6"
        >
          NFS-e Nacional · ABRASF · Receita Federal
        </motion.span>

        <motion.h1
          {...fadeUp(0.1)}
          className="font-display text-5xl md:text-6xl font-extrabold leading-tight mb-6"
        >
          Emita NFS-e do seu{' '}
          <span className="text-brand-cyan">MEI</span>{' '}
          em segundos via API
        </motion.h1>

        <motion.p
          {...fadeUp(0.2)}
          className="text-text-2 text-xl mb-10 max-w-2xl mx-auto"
        >
          Integre a emissão de notas fiscais ao seu ERP, SaaS ou app com uma
          única chamada REST. Sem burocracia, sem sistema municipal, direto
          na Receita Federal Nacional.
        </motion.p>

        <motion.div
          {...fadeUp(0.3)}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/cadastro"
            className="bg-brand-cyan text-navy-900 font-semibold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition"
          >
            Começar grátis por 30 dias
          </Link>
          <a
            href="/docs"
            className="border border-navy-600 text-text-1 font-semibold px-8 py-4 rounded-xl text-lg hover:border-brand-cyan transition"
          >
            Ver documentação
          </a>
        </motion.div>

        <motion.p {...fadeUp(0.4)} className="text-text-2 text-sm mt-4">
          Sem cartão de crédito · Cancele quando quiser
        </motion.p>
      </div>
    </section>
  )
}

// Static fallback used when prefers-reduced-motion is set
function HeroContent() {
  return (
    <section className="pt-32 pb-24 px-4 text-center">
      <div className="mx-auto max-w-3xl">
        <span className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-6">
          NFS-e Nacional · ABRASF · Receita Federal
        </span>
        <h1 className="font-display text-5xl md:text-6xl font-extrabold leading-tight mb-6">
          Emita NFS-e do seu{' '}
          <span className="text-brand-cyan">MEI</span>{' '}
          em segundos via API
        </h1>
        <p className="text-text-2 text-xl mb-10 max-w-2xl mx-auto">
          Integre a emissão de notas fiscais ao seu ERP, SaaS ou app com uma
          única chamada REST. Sem burocracia, sem sistema municipal, direto
          na Receita Federal Nacional.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/cadastro" className="bg-brand-cyan text-navy-900 font-semibold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition">
            Começar grátis por 30 dias
          </Link>
          <a href="/docs" className="border border-navy-600 text-text-1 font-semibold px-8 py-4 rounded-xl text-lg hover:border-brand-cyan transition">
            Ver documentação
          </a>
        </div>
        <p className="text-text-2 text-sm mt-4">Sem cartão de crédito · Cancele quando quiser</p>
      </div>
    </section>
  )
}
