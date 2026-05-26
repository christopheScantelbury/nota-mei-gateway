import Link from 'next/link'

// Pure CSS animation — no framer-motion dependency.
// animate-fade-up is defined in globals.css and respects prefers-reduced-motion.

function delay(ms: number) {
  return { style: { animationDelay: `${ms}ms` } }
}

export default function HeroSection() {
  return (
    <section className="pt-32 pb-16 px-4 text-center">
      <div className="mx-auto max-w-4xl">
        <span
          className="animate-fade-up inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-8"
          {...delay(0)}
        >
          NFS-e Nacional · ABRASF · Receita Federal
        </span>

        <h1
          className="animate-fade-up font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4"
          {...delay(80)}
        >
          Emissão de NFS-e Nacional,{' '}
          <span className="text-brand-cyan">sem complicação.</span>
        </h1>

        <p className="animate-fade-up text-text-2 text-lg mb-12" {...delay(160)}>
          Para MEI, ME/EPP e integradores. Escolha o seu:
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
            primary={false}
          />
          <ProductCard
            emoji="🏢"
            name="Nota ME / EPP"
            desc="Sou Microempresa. NFS-e Nacional obrigatória em Set/2026. Simples Nacional e Lucro Presumido."
            cta="Cadastrar minha ME →"
            href="/me"
            primary={false}
            badge="Novo"
          />
          <ProductCard
            emoji="</>"
            name="Nota MEI Gateway"
            desc="Sou desenvolvedor e quero integrar emissão de NFS-e ao meu produto via API."
            cta="Ver a API →"
            href="/gateway"
            primary={false}
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

function ProductCard({
  emoji,
  name,
  desc,
  cta,
  href,
  primary,
  badge,
}: {
  emoji: string
  name: string
  desc: string
  cta: string
  href: string
  primary: boolean
  badge?: string
}) {
  return (
    <div className="bg-navy-700 border border-navy-600 rounded-2xl p-8 flex flex-col gap-4 text-left hover:border-brand-cyan transition-colors group relative">
      {badge && (
        <span className="absolute top-4 right-4 text-xs font-semibold bg-brand-cyan/20
                         text-brand-cyan px-2 py-0.5 rounded-full border border-brand-cyan/30">
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
