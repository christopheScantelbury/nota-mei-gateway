/**
 * SectionRenderer — switch dinâmico por tipo de section do CMS (#242).
 *
 * Cada section do banco tem `tipo` + `data` (JSONB). Renderiza o
 * component apropriado. Tipos desconhecidos viram fallback silent
 * (log no console, sem quebrar UI).
 */

import type { LandingSection } from '@/lib/admin/landing'

export interface SectionRendererProps {
  section: LandingSection
  /** Quando true, lê draft_data em vez de live_data (modo preview). */
  preview?: boolean
}

export default function SectionRenderer({ section, preview }: SectionRendererProps) {
  const data = (preview ? section.draft_data : section.live_data) ?? section.draft_data ?? {}

  switch (section.tipo) {
    case 'hero':
      return <HeroSection data={data} />
    case 'pricing':
      return <PricingSection data={data} />
    case 'features':
      return <FeaturesSection data={data} />
    case 'faq':
      return <FAQSection data={data} />
    case 'cta':
      return <CTASection data={data} />
    case 'urgency_banner':
      return <UrgencySection data={data} />
    case 'custom_html':
      return <CustomHTMLSection data={data} />
    default:
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[SectionRenderer] Tipo desconhecido: ${section.tipo}`)
      }
      return null
  }
}

// ── Renders simples MVP. Próxima iteração: componentes reaproveitando
//    o que já existe em components/landing/*Section.tsx
// ─────────────────────────────────────────────────────────────────────

function HeroSection({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? 'NotaFácil — emissão de NFS-e Nacional')
  const subtitle = String(data.subtitle ?? '')
  const ctaLabel = String(data.cta_label ?? 'Começar grátis')
  const ctaHref = String(data.cta_href ?? '/cadastro')

  return (
    <section className="py-24 px-4 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-4">{title}</h1>
        {subtitle && <p className="text-text-2 text-lg mb-8">{subtitle}</p>}
        <a
          href={ctaHref}
          className="inline-block bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-lg hover:opacity-90"
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  )
}

function PricingSection({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? 'Planos')
  const plans = Array.isArray(data.plans) ? (data.plans as Array<Record<string, unknown>>) : []
  return (
    <section className="py-16 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-extrabold text-center mb-10">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <div key={i} className="rounded-xl border border-navy-600 bg-navy-700 p-6">
              <p className="font-display text-lg font-extrabold mb-2">{String(p.name ?? '')}</p>
              <p className="text-2xl font-mono mb-3">{String(p.price ?? '')}</p>
              <p className="text-text-2 text-sm">{String(p.description ?? '')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? 'Features')
  const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : []
  return (
    <section className="py-16 px-4 bg-navy-700/40">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-extrabold text-center mb-10">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {items.map((f, i) => (
            <div key={i}>
              <p className="text-3xl mb-2">{String(f.icon ?? '✨')}</p>
              <p className="font-bold mb-1">{String(f.title ?? '')}</p>
              <p className="text-text-2 text-sm">{String(f.description ?? '')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQSection({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? 'Perguntas frequentes')
  const items = Array.isArray(data.items) ? (data.items as Array<{ q?: string; a?: string }>) : []
  return (
    <section className="py-16 px-4">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-extrabold text-center mb-8">{title}</h2>
        <div className="space-y-3">
          {items.map((f, i) => (
            <details key={i} className="rounded-xl border border-navy-600 bg-navy-700 p-5">
              <summary className="font-semibold cursor-pointer">{String(f.q ?? '')}</summary>
              <p className="text-text-2 text-sm mt-3">{String(f.a ?? '')}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? 'Pronto pra começar?')
  const ctaLabel = String(data.cta_label ?? 'Criar conta')
  const ctaHref = String(data.cta_href ?? '/cadastro')
  return (
    <section className="py-16 px-4 text-center bg-gradient-to-br from-brand-cyan/10 to-amber-500/10">
      <h2 className="font-display text-3xl font-extrabold mb-6">{title}</h2>
      <a href={ctaHref} className="bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-lg">
        {ctaLabel}
      </a>
    </section>
  )
}

function UrgencySection({ data }: { data: Record<string, unknown> }) {
  const text = String(data.text ?? '')
  if (!text) return null
  return (
    <div className="bg-amber-500/10 border-y border-amber-500/30 py-3 px-4 text-center text-sm">
      <span className="text-amber-300">{text}</span>
    </div>
  )
}

function CustomHTMLSection({ data }: { data: Record<string, unknown> }) {
  const html = String(data.html ?? '')
  if (!html) return null
  // sanitize handled by admin (já confiável). MVP.
  return <section dangerouslySetInnerHTML={{ __html: html }} />
}
