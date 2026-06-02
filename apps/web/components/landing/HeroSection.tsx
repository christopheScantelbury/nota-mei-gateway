'use client'

import Link from 'next/link'
import PioneerBadge from '@/components/badges/PioneerBadge'
import CountdownSet2026 from '@/components/countdown/CountdownSet2026'
import { trackCtaClick, type Persona, type CtaLocation } from '@/lib/analytics/events'

// Pure CSS animation — no framer-motion dependency.
// animate-fade-up is defined in globals.css and respects prefers-reduced-motion.

function delay(ms: number) {
  return { style: { animationDelay: `${ms}ms` } }
}

/**
 * Hero da home — copies finais HIST-1.4 + HIST-1.2 (PioneerBadge) + HIST-1.3 (Countdown)
 * + HIST-3.1 (sandbox CTA no card Dev). Tracking GA4 via trackCtaClick em todos os CTAs.
 */
export default function HeroSection() {
  return (
    <section className="pt-32 pb-16 px-4 text-center">
      <div className="mx-auto max-w-4xl">
        {/* Eyebrow */}
        <span
          className="animate-fade-up inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-4"
          {...delay(0)}
        >
          NFS-e Nacional · ABRASF · Receita Federal
        </span>

        {/* Pioneer Badge (HIST-1.2) */}
        <div className="animate-fade-up mb-8 flex justify-center" {...delay(40)}>
          <PioneerBadge variant="hero" />
        </div>

        {/* H1 — copy final aprovada (HIST-1.4 variante A controle) */}
        <h1
          className="animate-fade-up font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4"
          {...delay(80)}
        >
          Sua NFS-e Nacional pronta{' '}
          <span className="text-brand-cyan">antes de setembro/2026</span>
        </h1>

        {/* Subtítulo final aprovado */}
        <p className="animate-fade-up text-text-2 text-lg mb-10 max-w-3xl mx-auto" {...delay(160)}>
          Para MEI, ME/EPP e desenvolvedores. A primeira plataforma a emitir e cancelar NFS-e Nacional em produção. Migre agora — quanto mais perto da vigência, mais lotado fica o caminho.
        </p>

        {/* Texto acima dos cards */}
        <p className="animate-fade-up text-text-2 text-sm font-semibold mb-6 uppercase tracking-wider" {...delay(200)}>
          Escolha seu caminho:
        </p>

        <div
          className="animate-fade-up grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto"
          {...delay(240)}
        >
          <ProductCard
            emoji="📱"
            name="Nota Fácil MEI"
            desc="Sou MEI e quero emitir minha nota em 30 segundos, sem entender de imposto."
            cta="Quero usar →"
            href="/mei"
            persona="mei"
            location="hero_card_mei"
          />
          <ProductCard
            emoji="🏢"
            name="Nota ME / EPP"
            desc="Sou Microempresa. NFS-e Nacional obrigatória em Set/2026. Simples Nacional e Lucro Presumido — pronto para os dois regimes."
            cta="Cadastrar minha ME →"
            href="/me"
            badge="Obrigatório Set/2026"
            persona="me"
            location="hero_card_me"
            showCountdown
          />
          <ProductCard
            emoji="</>"
            name="Nota MEI Gateway"
            desc="Sou desenvolvedor e quero integrar emissão de NFS-e ao meu produto via API."
            cta="Ver a API →"
            href="/gateway"
            persona="dev"
            location="hero_card_dev"
            sandboxCta
          />
        </div>

        <p className="animate-fade-up text-text-2 text-xs mt-10" {...delay(320)}>
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

interface ProductCardProps {
  emoji: string
  name: string
  desc: string
  cta: string
  href: string
  persona: Persona
  location: CtaLocation
  badge?: string
  showCountdown?: boolean
  sandboxCta?: boolean
}

function ProductCard({
  emoji,
  name,
  desc,
  cta,
  href,
  persona,
  location,
  badge,
  showCountdown,
  sandboxCta,
}: ProductCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-2xl p-8 flex flex-col gap-4 text-left hover:border-brand-cyan transition-colors group relative">
      {badge && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/40 whitespace-nowrap">
          {badge}
        </span>
      )}
      <span className="font-mono text-brand-cyan text-2xl font-bold">{emoji}</span>
      <div>
        <p className="font-display text-xl font-extrabold text-text-1 group-hover:text-brand-cyan transition-colors">
          {name}
        </p>
        <p className="text-text-2 text-sm mt-2 leading-relaxed">{desc}</p>
      </div>
      {showCountdown && (
        <div className="text-xs text-amber-300/90 border border-amber-500/30 bg-amber-500/5 rounded-lg px-3 py-2">
          <p className="text-[11px] text-amber-200/80 mb-1">Faltam para a obrigatoriedade:</p>
          <CountdownSet2026 size="compact" />
        </div>
      )}
      <Link
        href={href}
        onClick={() => trackCtaClick({ persona, location })}
        className="mt-auto text-center text-sm font-semibold px-6 py-3 rounded-lg transition border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan"
      >
        {cta}
      </Link>
      {sandboxCta && (
        <Link
          href="/sandbox"
          onClick={() => trackCtaClick({ persona: 'dev', location: 'sandbox_hero' })}
          className="text-center text-xs text-brand-cyan hover:underline -mt-2"
        >
          ⚡ Testar no navegador em 30s · sem cadastro
        </Link>
      )}
    </div>
  )
}
