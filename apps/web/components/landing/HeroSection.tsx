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
 * Hero da home — hierarquia reordenada pelo pack Manaus (2026-06-22, §4.2).
 *
 * Antes: 3 cards iguais (MEI · ME · Gateway).
 * Agora:
 *   - ME/EPP e Gateway viram CARDS PRIMÁRIOS (lado a lado, peso visual igual)
 *   - MEI vira CARD SECUNDÁRIO (faixa horizontal menor abaixo)
 *
 * Motivação: ME/EPP tem LTV alto + obrigação legal + multi-empresa nativo;
 * Gateway tem margem 95%; MEI é mais sensível a preço e tem o emissor público
 * grátis como concorrente direto. Não tirar o MEI do funil, só não gastar
 * atenção primária com ele.
 */
export default function HeroSection() {
  return (
    <section className="pt-32 pb-16 px-4 text-center">
      <div className="mx-auto max-w-5xl">
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

        {/* H1 — copy pack Manaus §4.2 */}
        <h1
          className="animate-fade-up font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4"
          {...delay(80)}
        >
          Sua empresa pronta para a{' '}
          <span className="text-brand-cyan">NFS-e Nacional</span> — sem dor de cabeça fiscal
        </h1>

        {/* Subtítulo — pack Manaus §4.2 */}
        <p className="animate-fade-up text-text-2 text-lg mb-10 max-w-3xl mx-auto" {...delay(160)}>
          Para ME, EPP e desenvolvedores. Emissão e cancelamento de NFS-e Nacional em produção,
          com integração direta à Receita Federal. Onde a obrigatoriedade já chegou, a gente
          resolve hoje.
        </p>

        <p className="animate-fade-up text-text-2 text-sm font-semibold mb-6 uppercase tracking-wider" {...delay(200)}>
          Escolha seu caminho
        </p>

        {/* ── Cards primários: ME + Gateway lado a lado ─────────────────────── */}
        <div
          className="animate-fade-up grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto"
          {...delay(240)}
        >
          <PrimaryCard
            emoji="🏢"
            name="Nota ME / EPP"
            desc="Simples Nacional e Lucro Presumido, multi-empresa nativo. Obrigatório e pronto."
            cta="Cadastrar minha empresa →"
            href="/me"
            badge="Obrigatório Set/2026"
            persona="me"
            location="hero_card_me"
            showCountdown
          />
          <PrimaryCard
            emoji="</>"
            name="Gateway API"
            desc="Integre emissão ao seu produto via API REST. Sandbox público sem cadastro."
            cta="Ver a API →"
            href="/gateway"
            persona="dev"
            location="hero_card_dev"
            sandboxCta
          />
        </div>

        {/* ── Card secundário: MEI (faixa horizontal menor) ─────────────────── */}
        <div className="animate-fade-up max-w-4xl mx-auto mt-5" {...delay(280)}>
          <SecondaryCard
            name="É MEI?"
            desc="Emita sua nota em 30 segundos, sem entender de imposto."
            cta="Quero usar"
            href="/mei"
            persona="mei"
            location="hero_card_mei"
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

interface PrimaryCardProps {
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

function PrimaryCard({
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
}: PrimaryCardProps) {
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-2xl p-7 sm:p-8 flex flex-col gap-4 text-left hover:border-brand-cyan transition-colors group relative">
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
        className="mt-auto text-center text-sm font-semibold px-6 py-3 rounded-lg transition bg-brand-cyan text-navy-900 hover:opacity-90"
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

interface SecondaryCardProps {
  name: string
  desc: string
  cta: string
  href: string
  persona: Persona
  location: CtaLocation
}

function SecondaryCard({ name, desc, cta, href, persona, location }: SecondaryCardProps) {
  return (
    <div className="bg-navy-700/50 border border-navy-600 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 text-left hover:border-brand-cyan transition-colors">
      <span className="text-2xl shrink-0" aria-hidden>📱</span>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-text-1 text-base">{name}</p>
        <p className="text-text-2 text-sm mt-0.5">{desc}</p>
      </div>
      <Link
        href={href}
        onClick={() => trackCtaClick({ persona, location })}
        className="shrink-0 text-sm font-semibold px-5 py-2.5 rounded-lg border border-navy-600 text-text-1 hover:border-brand-cyan hover:text-brand-cyan transition whitespace-nowrap"
      >
        {cta} →
      </Link>
    </div>
  )
}
