import Link from 'next/link'

// ── Ecossistema ScantelburyDevs ─────────────────────────────────────────────
// Card destacado = produto atual (NotaFácil). Outros cards levam para os
// produtos irmãos. Reutilize em qualquer landing antes do <LandingFooter />.

type Produto = {
  nome:     string
  subtitulo: string
  href:     string | null  // null = card "você está aqui"
  dotColor: string         // classe Tailwind para o pontinho
}

const PRODUTOS: Produto[] = [
  {
    nome:      'NotaFácil',
    subtitulo: 'Emissão de NFS-e Nacional',
    href:      null, // produto atual
    dotColor:  'bg-brand-blue',
  },
  {
    nome:      'EventGear',
    subtitulo: 'Gestão de eventos e contratos',
    href:      'https://eventgear-web.h1dq2d.easypanel.host/',
    dotColor:  'bg-persona-emp', // coral
  },
  {
    nome:      'AgendaInteligente',
    subtitulo: 'Agendamentos com IA',
    href:      'https://agendainteligentefrontend.agendainteligenteapp.cloud/',
    dotColor:  'bg-persona-api', // purple
  },
]

export default function EcossistemaScantelbury() {
  return (
    <section className="py-20 px-4 border-t border-navy-600/40">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-mono font-semibold uppercase tracking-[0.25em] text-text-2 mb-3">
          Ecossistema
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-text-1 mb-10">
          Integrado ao ecossistema ScantelburyDevs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PRODUTOS.map((p) => {
            const isCurrent = p.href === null
            const inner = (
              <div
                className={[
                  'rounded-2xl border bg-navy-700 p-6 text-left transition-all',
                  isCurrent
                    ? 'border-brand-blue/40 shadow-glow-blue cursor-default'
                    : 'border-navy-600 hover:border-brand-blue/40 hover:-translate-y-0.5',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.dotColor}`} aria-hidden="true" />
                  <span className="font-display text-base font-bold text-text-1">{p.nome}</span>
                </div>
                <p className="text-sm text-text-2">{p.subtitulo}</p>
                {isCurrent && (
                  <p className="mt-3 text-xs font-medium text-brand-blue">
                    Você está aqui
                  </p>
                )}
              </div>
            )

            if (isCurrent) {
              return <div key={p.nome}>{inner}</div>
            }

            return (
              <Link
                key={p.nome}
                href={p.href!}
                target="_blank"
                rel="noopener noreferrer"
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 rounded-2xl"
              >
                {inner}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
