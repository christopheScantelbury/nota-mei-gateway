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
    <section className="pt-32 pb-16 px-4 text-center">
      <div className="mx-auto max-w-4xl">
        <motion.span
          {...fadeUp(0)}
          className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-8"
        >
          NFS-e Nacional · ABRASF · Receita Federal
        </motion.span>

        <motion.h1
          {...fadeUp(0.1)}
          className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4"
        >
          Emissão de NFS-e do MEI,{' '}
          <span className="text-brand-cyan">sem complicação.</span>
        </motion.h1>

        <motion.p {...fadeUp(0.2)} className="text-text-2 text-lg mb-12">
          Escolha como você quer usar:
        </motion.p>

        <motion.div
          {...fadeUp(0.3)}
          className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto"
        >
          <ProductCard
            emoji="📱"
            name="Nota Fácil MEI"
            desc="Sou MEI e quero emitir minha nota em 30 segundos, sem entender de imposto."
            cta="Quero usar →"
            href="/mei"
            primary
          />
          <ProductCard
            emoji="</>"
            name="Nota MEI Gateway"
            desc="Sou desenvolvedor e quero integrar emissão de NFS-e ao meu produto via API."
            cta="Ver a API →"
            href="/api"
            primary={false}
          />
        </motion.div>

        <motion.p {...fadeUp(0.4)} className="text-text-2 text-xs mt-10">
          Desenvolvido por{' '}
          <a
            href="https://scantelburydevs.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-1 transition"
          >
            ScantelburyDevs
          </a>
        </motion.p>
      </div>
    </section>
  )
}

function ProductCard({
  emoji,
  name,
  desc,
  cta,
  href,
  primary,
}: {
  emoji: string
  name: string
  desc: string
  cta: string
  href: string
  primary: boolean
}) {
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-2xl p-8 flex flex-col gap-4 text-left hover:border-brand-cyan transition-colors group">
      <span className="font-mono text-brand-cyan text-2xl font-bold">{emoji}</span>
      <div>
        <p className="font-display text-xl font-extrabold text-text-1 group-hover:text-brand-cyan transition-colors">
          {name}
        </p>
        <p className="text-text-2 text-sm mt-2 leading-relaxed">{desc}</p>
      </div>
      <Link
        href={href}
        className={`mt-auto text-center text-sm font-semibold px-6 py-3 rounded-lg transition ${
          primary
            ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
            : 'border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}

function HeroContent() {
  return (
    <section className="pt-32 pb-16 px-4 text-center">
      <div className="mx-auto max-w-4xl">
        <span className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-8">
          NFS-e Nacional · ABRASF · Receita Federal
        </span>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4">
          Emissão de NFS-e do MEI,{' '}
          <span className="text-brand-cyan">sem complicação.</span>
        </h1>
        <p className="text-text-2 text-lg mb-12">Escolha como você quer usar:</p>
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <ProductCard
            emoji="📱"
            name="Nota Fácil MEI"
            desc="Sou MEI e quero emitir minha nota em 30 segundos, sem entender de imposto."
            cta="Quero usar →"
            href="/mei"
            primary
          />
          <ProductCard
            emoji="</>"
            name="Nota MEI Gateway"
            desc="Sou desenvolvedor e quero integrar emissão de NFS-e ao meu produto via API."
            cta="Ver a API →"
            href="/api"
            primary={false}
          />
        </div>
        <p className="text-text-2 text-xs mt-10">
          Desenvolvido por{' '}
          <a
            href="https://scantelburydevs.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-1 transition"
          >
            ScantelburyDevs
          </a>
        </p>
      </div>
    </section>
  )
}
