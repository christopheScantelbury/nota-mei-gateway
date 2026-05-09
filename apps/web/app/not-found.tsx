import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'

export const metadata: Metadata = {
  title: 'Página não encontrada · NotaFácil',
  description:
    'A página que você procura não existe ou foi movida. Veja as opções disponíveis e volte para o início.',
  robots: { index: false, follow: true },
}

const ATALHOS = [
  { href: '/mei',     emoji: '🧾', title: 'NotaFácil MEI',     desc: 'Emissão simples de NFS-e para MEI no celular' },
  { href: '/me',      emoji: '🏢', title: 'NotaFácil Empresa', desc: 'NFS-e Nacional para ME e EPP — obrigatório em set/2026' },
  { href: '/gateway', emoji: '🔌', title: 'NotaFácil API',     desc: 'Integre emissão de NFS-e no seu SaaS via API REST' },
  { href: '/blog',    emoji: '📚', title: 'Blog',              desc: 'Guias práticos sobre NFS-e, certificado A1 e tributação' },
  { href: '/precos',  emoji: '💳', title: 'Preços',            desc: 'Planos a partir do gratuito · sem cartão de crédito' },
  { href: '/docs',    emoji: '⚙️', title: 'Documentação',      desc: 'API REST, webhooks, SDKs e exemplos prontos' },
]

export default function NotFound() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <Navbar />

      <section className="pt-32 pb-12 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-mono font-semibold uppercase tracking-[0.25em] text-text-2 mb-3">
            Erro 404
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            Essa página não existe.
          </h1>
          <p className="text-text-2 text-lg max-w-xl mx-auto leading-relaxed">
            Pode ter sido movida ou o link está errado. Confira as opções abaixo
            ou volte para a <Link href="/" className="text-brand-blue hover:underline font-medium">página inicial</Link>.
          </p>
        </div>
      </section>

      <section className="pb-20 px-4">
        <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ATALHOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="block rounded-2xl border border-navy-600 bg-navy-700 p-5 hover:border-brand-blue/40 hover:-translate-y-0.5 transition-all"
            >
              <span className="text-2xl mb-3 block" aria-hidden="true">{a.emoji}</span>
              <h2 className="font-display font-bold text-text-1 mb-1">{a.title}</h2>
              <p className="text-text-2 text-sm leading-snug">{a.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
