import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Obrigatoriedade NFS-e para MEI em 2026',
  description:
    'A partir de 2026, todo MEI prestador de serviços é obrigado a emitir NFS-e pela Receita Federal Nacional. Entenda o que muda e como se preparar.',
  alternates: { canonical: 'https://emitirnotafacil.com.br/obrigatoriedade-nfse-mei' },
}

export default function ObrigatoriedadePage() {
  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body">
      {/* Minimal navbar */}
      <header className="border-b border-navy-600 bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/mei" className="flex items-center shrink-0">
            <Image
              src="/logos/nfm-logo-navbar-dark-clean.svg"
              alt="Nota Fácil MEI"
              width={140}
              height={38}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <Link href="/mei" className="text-sm text-text-2 hover:text-brand-cyan transition">
            ← Nota Fácil MEI
          </Link>
        </div>
      </header>

      <main>
      <div className="mx-auto max-w-3xl px-4 py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-2 mb-8">
          <Link href="/" className="hover:text-text-1 transition">Início</Link>
          <span>/</span>
          <Link href="/mei" className="hover:text-text-1 transition">Nota Fácil MEI</Link>
          <span>/</span>
          <span>Obrigatoriedade NFS-e 2026</span>
        </div>

        {/* Header */}
        <span className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full mb-6">
          ⚠️ Em vigor — 2026
        </span>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-4">
          Obrigatoriedade da NFS-e para MEI em 2026
        </h1>
        <p className="text-text-2 text-lg leading-relaxed mb-12">
          A partir de 2026, todo MEI prestador de serviços é obrigado a emitir nota fiscal eletrônica (NFS-e)
          pelo sistema nacional da Receita Federal. Veja o que muda e como se preparar.
        </p>

        {/* Content */}
        <div className="space-y-10 text-sm text-text-2 leading-relaxed">

          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-text-1">O que é a NFS-e Nacional?</h2>
            <p>
              A NFS-e Nacional (Nota Fiscal de Serviços eletrônica) é o padrão da Receita Federal para emissão
              de notas fiscais de serviços em todo o Brasil. Desenvolvida pela Receita Federal e pelo SERPRO,
              ela substitui os sistemas municipais e unifica a emissão em uma única plataforma.
            </p>
            <p>
              O sistema segue o padrão <strong className="text-text-1">ABRASF v3.0</strong> e exige
              certificado digital A1 para assinar cada nota.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-text-1">O que muda para o MEI?</h2>
            <ul className="space-y-3">
              {[
                'Emissão obrigatória via plataforma federal — não mais pelos sistemas municipais',
                'Certificado A1 obrigatório para assinar digitalmente cada nota',
                'Notas emitidas em XML e PDF com chave de verificação',
                'Integração com o PGMEI para controle do DAS mensal',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="shrink-0 text-brand-cyan mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-text-1">Quem é obrigado?</h2>
            <p>
              Todo MEI que presta serviços — independente do valor, frequência ou tipo de tomador
              (pessoa física ou jurídica). MEI que atua somente com comércio ou indústria não precisa
              emitir NFS-e.
            </p>
            <div className="bg-navy-700 border border-navy-600 rounded-xl p-4">
              <p className="text-text-1 font-semibold mb-2">Exemplos de serviços obrigados:</p>
              <p className="text-xs">
                Desenvolvimento de software · Consultoria · Design · Marketing digital ·
                Transporte (app) · Serviços de limpeza · Aulas particulares · Fotografia ·
                Manutenção de equipamentos · e mais de 300 atividades de serviço.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-text-1">Como me preparar?</h2>
            <ol className="space-y-3">
              {[
                {
                  n: 1,
                  text: (
                    <>
                      Obtenha seu certificado digital A1 (e-CPF ou e-CNPJ MEI) — disponível em certificadoras como Certisign, Serasa e Receita Federal.{' '}
                      <Link href="/certificado-a1" className="text-brand-cyan hover:underline">
                        O que é e onde obter →
                      </Link>
                    </>
                  ),
                },
                { n: 2, text: 'Cadastre seu MEI na Nota Fácil MEI com o certificado — o sistema já está integrado ao sistema federal.' },
                { n: 3, text: 'Emita suas notas com poucos cliques pelo painel — ou automaticamente se você usar um sistema de gestão.' },
              ].map(({ n, text }) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold flex items-center justify-center mt-0.5">
                    {n}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>

        </div>

        {/* CTA */}
        <div className="mt-12 bg-navy-700 border border-navy-600 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <p className="font-display font-bold text-text-1">Pronto para emitir?</p>
            <p className="text-text-2 text-sm">Trial grátis · Sem cartão · Integração em minutos.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/cadastro"
              className="bg-brand-cyan text-navy-900 font-semibold px-6 py-2.5 rounded-lg text-sm hover:opacity-90 transition whitespace-nowrap"
            >
              Criar conta grátis
            </Link>
            <Link
              href="/docs"
              className="border border-navy-600 text-text-1 font-semibold px-6 py-2.5 rounded-lg text-sm hover:border-brand-cyan transition whitespace-nowrap"
            >
              Ver a API
            </Link>
          </div>
        </div>

        {/* Source */}
        <p className="mt-8 text-xs text-text-2">
          Fonte:{' '}
          <a
            href="https://www.nfse.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-text-1 transition"
          >
            Portal NFS-e Nacional — Receita Federal
          </a>
        </p>

      </div>
      </main>

      {/* Minimal footer */}
      <footer className="border-t border-navy-600 py-6 px-4 mt-8">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-between items-center gap-3 text-xs text-text-2">
          <p>© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link href="/mei" className="hover:text-text-1 transition">Nota Fácil MEI</Link>
            <Link href="/privacidade" className="hover:text-text-1 transition">Privacidade</Link>
            <Link href="/termos" className="hover:text-text-1 transition">Termos</Link>
            <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
