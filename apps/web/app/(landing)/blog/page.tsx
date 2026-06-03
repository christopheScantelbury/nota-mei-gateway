import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import { BLOG_POSTS } from '@/lib/blog/manifest'

export const metadata: Metadata = {
  title: 'Blog NotaFácil — guias práticos sobre NFS-e, MEI e ME',
  description:
    'Guias completos sobre emissão de NFS-e Nacional, certificado A1, regimes tributários, migração MEI → ME e tudo o que o empreendedor precisa saber.',
  alternates: { canonical: 'https://emitirnotafacil.com.br/blog' },
  openGraph: {
    title: 'Blog NotaFácil',
    description: 'Guias práticos sobre NFS-e Nacional, MEI, ME e EPP.',
    url: 'https://emitirnotafacil.com.br/blog',
    siteName: 'NotaFácil',
    locale: 'pt_BR',
    type: 'website',
  },
}

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <Navbar />

      <section className="pt-32 pb-12 px-4">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block bg-navy-700 border border-navy-600 text-brand-blue text-xs font-semibold px-3 py-1 rounded-full mb-6">
            Blog NotaFácil
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-4">
            Guias práticos para emitir notas com confiança
          </h1>
          <p className="text-text-2 text-lg max-w-2xl mx-auto leading-relaxed">
            NFS-e Nacional, certificado A1, regimes tributários, migração MEI → ME.
            O que você precisa saber, em linguagem direta.
          </p>
        </div>
      </section>

      <section className="pb-20 px-4">
        <div className="mx-auto max-w-4xl grid gap-5">
          {BLOG_POSTS.map((post) => {
            const dataPub = new Date(post.publishedAt).toLocaleDateString('pt-BR', {
              day: '2-digit', month: 'long', year: 'numeric',
            })
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-2xl border border-navy-600 bg-navy-700 p-6 hover:border-brand-blue/40 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-2 mb-3">
                  <span>{dataPub}</span>
                  <span>·</span>
                  <span>{post.readTimeMin} min</span>
                  <span className="ml-auto flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-navy-900 border border-navy-600 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
                <h2 className="font-display text-xl md:text-2xl font-extrabold text-text-1 mb-2">
                  {post.title}
                </h2>
                <p className="text-text-2 leading-relaxed">{post.description}</p>
                <span className="inline-block text-brand-blue text-sm font-medium mt-4">
                  Ler artigo →
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <LandingFooter />
    </main>
  )
}
