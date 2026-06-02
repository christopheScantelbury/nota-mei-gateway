import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import CompetitorTable from '@/components/competitor/CompetitorTable'
import PioneerBadge from '@/components/badges/PioneerBadge'

/**
 * Página /comparativo — landing dedicada de comparação NotaFácil vs concorrentes.
 *
 * Spec: HIST-4.2 + 03-Copies-Finais.md.
 * Dark-first como o resto da landing.
 */

export const metadata: Metadata = {
  title: 'NotaFácil vs concorrentes — Comparativo de emissores de NFS-e Nacional',
  description:
    'Compare NotaFácil com Focus NFe, eNotas e PlugNotas. Saiba por que somos a única plataforma nativa para a NFS-e Nacional, com sandbox sem cadastro e atendimento ao MEI.',
  alternates: { canonical: 'https://emitirnotafacil.com.br/comparativo' },
  openGraph: {
    title: 'NotaFácil vs concorrentes — NFS-e Nacional',
    description: 'Comparativo completo. Veja as diferenças.',
    url: 'https://emitirnotafacil.com.br/comparativo',
    siteName: 'NotaFácil',
    locale: 'pt_BR',
    type: 'website',
  },
}

const FAQ = [
  { q: 'Quanto custa migrar do meu emissor atual para o NotaFácil?',                       a: 'A migração é gratuita. O trial de 30 dias sem cartão dá tempo de validar a integração em paralelo ao seu sistema atual antes de cancelar o concorrente. Devs: o sandbox sem cadastro permite testar antes mesmo de criar conta.' },
  { q: 'Vocês cobrem todos os municípios?',                                                 a: 'Sim — todos os municípios que aderiram à NFS-e Nacional, hoje mais de 5.000. Como somos nativos do padrão nacional (não dependemos de integração caso-a-caso com prefeituras), novos municípios entram automaticamente quando aderem.' },
  { q: 'Diferente do Focus NFe, vocês têm cobertura municipal completa?',                  a: 'Focus NFe e similares construíram cobertura via integrações caso-a-caso com cada prefeitura. Faz sentido para quem precisa do padrão ABRASF municipal antigo. Nós focamos exclusivamente no padrão nacional, que será obrigatório para todos a partir de Set/2026. Para o universo NFS-e Nacional, nossa cobertura é total.' },
  { q: 'Posso usar a API e a interface web ao mesmo tempo?',                                a: 'Sim. Diferente do eNotas (cuja API só vem nos planos Plus e Pro), todo plano ME/EPP e Gateway inclui acesso à API REST. Você usa a interface para emissões manuais e a API para o que está automatizado.' },
  { q: 'Vocês atendem MEI?',                                                                a: 'Sim — somos o único player do mercado com produto dedicado para MEI. O eNotas declara abertamente que não atende MEI. Focus NFe e PlugNotas atendem mas com o mesmo produto corporate, sem interface simplificada para emissão esporádica.' },
  { q: 'E se eu precisar emitir NFC-e, NF-e ou CT-e também?',                               a: 'Hoje focamos em NFS-e Nacional. Para NFC-e/NF-e/CT-e (operações com produtos físicos), recomendamos players especializados como o Focus NFe. Nosso roadmap inclui suporte a NFC-e em 2027 com a convergência completa do padrão nacional.' },
]

export default function ComparativoPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Comparativo NotaFácil vs concorrentes',
    description: 'Comparativo de plataformas de emissão de NFS-e Nacional.',
    url: 'https://emitirnotafacil.com.br/comparativo',
    about: { '@type': 'Product', name: 'NotaFácil', brand: { '@type': 'Brand', name: 'ScantelburyDevs' } },
    mainEntity: {
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  }

  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-12 px-4 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Comparativo · NFS-e Nacional
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            Por que migrar para o{' '}
            <span className="text-brand-cyan">NotaFácil</span>
          </h1>
          <p className="text-text-2 text-lg mb-6 leading-relaxed">
            A única plataforma 100% nativa para a NFS-e Nacional, com produto dedicado para MEI, ME/EPP e desenvolvedores. Compare lado a lado com as principais alternativas do mercado.
          </p>
          <div className="flex justify-center">
            <PioneerBadge variant="hero" />
          </div>
        </div>
      </section>

      {/* Tabela completa */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-5xl">
          <CompetitorTable variant="full" source="page" />
        </div>
      </section>

      {/* 3 cards de diferencial */}
      <section className="py-12 px-4 bg-navy-700/30 border-y border-navy-600">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-center mb-10">
            3 motivos que fazem a diferença
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DiferencialCard title="Nativo, não adaptado" body="Construímos o NotaFácil em 2025 já pensando na NFS-e Nacional. Nada de SOAP/XSD herdado do padrão municipal ABRASF. Você fala REST + JSON + Bearer, e nós cuidamos do resto. Resultado: integração em horas, não em semanas." />
            <DiferencialCard title="Sandbox sem cadastro" body="Você testa nossa API agora mesmo no navegador, sem criar conta, sem cartão, sem e-mail. Os concorrentes pedem cadastro completo antes do primeiro request. Nós mostramos primeiro, conversamos depois." />
            <DiferencialCard title="Três personas, uma plataforma" body="Único player do mercado com produto dedicado para MEI (app simples), ME/EPP (interface web + API) e Dev (gateway). Quando seu cliente MEI virar ME, ele já está em casa." />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-center mb-10">
            Perguntas frequentes
          </h2>
          <div className="flex flex-col gap-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border border-navy-600 bg-navy-700 p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer font-semibold flex items-start gap-3 text-text-1">
                  <span className="text-brand-cyan group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                  <span>{q}</span>
                </summary>
                <p className="mt-3 text-sm text-text-2 leading-relaxed pl-7">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 px-4 bg-gradient-to-br from-brand-cyan/10 via-transparent to-amber-500/10 border-t border-navy-600">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold mb-3">Pronto para migrar?</h2>
          <p className="text-text-2 mb-6">
            Trial de 30 dias sem cartão. Cancele quando quiser.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/cadastro?utm_source=comparativo&utm_medium=cta&utm_content=final"
              className="bg-brand-cyan text-navy-900 font-semibold px-8 py-3 rounded-lg hover:opacity-90 transition"
            >
              Criar conta gratuita
            </Link>
            <Link
              href="/sandbox?utm_source=comparativo&utm_medium=cta&utm_content=final"
              className="border border-navy-500 text-text-1 font-semibold px-8 py-3 rounded-lg hover:bg-navy-700 transition"
            >
              Testar no sandbox
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  )
}

function DiferencialCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-navy-600 bg-navy-700 p-6">
      <h3 className="font-display text-lg font-extrabold mb-3 text-text-1">{title}</h3>
      <p className="text-sm text-text-2 leading-relaxed">{body}</p>
    </div>
  )
}
