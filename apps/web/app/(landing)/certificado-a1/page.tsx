import type { Metadata } from 'next'
import Link from 'next/link'
import LogoAdaptive from '@/components/ui/LogoAdaptive'

export const metadata: Metadata = {
  title: 'Certificado Digital A1 para MEI — O que é e onde obter',
  description:
    'Entenda o que é o certificado digital A1, onde comprar, como exportar o arquivo .pfx e por que ele é obrigatório para emitir NFS-e como MEI.',
  alternates: { canonical: 'https://emitirnotafacil.com.br/certificado-a1' },
}

const certificadoras = [
  {
    nome: 'Certisign',
    preco: 'A partir de R$ 149/ano',
    url: 'https://www.certisign.com.br',
    destaque: false,
  },
  {
    nome: 'Serasa Experian',
    preco: 'A partir de R$ 135/ano',
    url: 'https://www.serasacertificadora.com.br',
    destaque: false,
  },
  {
    nome: 'Valid Certificadora',
    preco: 'A partir de R$ 129/ano',
    url: 'https://www.validcertificadora.com.br',
    destaque: false,
  },
  {
    nome: 'Soluti',
    preco: 'A partir de R$ 119/ano',
    url: 'https://www.soluti.com.br',
    destaque: false,
  },
  {
    nome: 'Receita Federal (gratuito)',
    preco: 'Gratuito — para CPF',
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/senhas-e-procuracoes/senhas/certificados-digitais',
    destaque: true,
  },
]

const faqCert = [
  {
    q: 'Qual tipo de certificado preciso — e-CPF ou e-CNPJ?',
    a: 'Ambos funcionam para emitir NFS-e como MEI. O e-CPF é vinculado ao seu CPF pessoal; o e-CNPJ ao CNPJ do MEI. Para uso exclusivo no Nota Fácil MEI, qualquer um serve.',
  },
  {
    q: 'Qual é a validade do certificado A1?',
    a: 'Certificados A1 têm validade de 1 ano. Após o vencimento, é necessário renová-lo. O Nota Fácil MEI avisa com antecedência quando seu certificado estiver próximo do vencimento.',
  },
  {
    q: 'O que acontece se eu errar a senha do certificado?',
    a: 'Após um número de tentativas erradas (varia por certificadora), o certificado pode ser bloqueado. Guarde a senha em local seguro. Se bloqueado, você precisará revogar e emitir um novo.',
  },
  {
    q: 'Posso usar o mesmo certificado em outro sistema?',
    a: 'Sim. O certificado A1 é um arquivo padrão e pode ser usado em qualquer sistema que aceite o formato PKCS#12 (.pfx ou .p12). Você não fica preso ao Nota Fácil MEI.',
  },
]

export default function CertificadoA1Page() {
  return (
    <div className="min-h-screen bg-navy-900 text-text-1 font-body">

      {/* Navbar mínima */}
      <header className="border-b border-navy-600 bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/mei" className="flex items-center shrink-0">
            <LogoAdaptive
              lightSrc="/brand/notafacil-logo.svg"
              darkSrc="/brand/notafacil-logo-dark.svg"
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
          <div className="flex items-center gap-2 text-sm text-text-2 mb-8 flex-wrap">
            <Link href="/" className="hover:text-text-1 transition">Início</Link>
            <span>/</span>
            <Link href="/mei" className="hover:text-text-1 transition">Nota Fácil MEI</Link>
            <span>/</span>
            <span>Certificado digital A1</span>
          </div>

          {/* Header */}
          <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-4">
            O que é o certificado digital A1?
          </h1>
          <p className="text-text-2 text-lg leading-relaxed mb-12">
            O certificado digital A1 é um arquivo no seu computador que funciona como
            sua <strong className="text-text-1">assinatura eletrônica</strong>. A Receita Federal
            exige esse arquivo para assinar digitalmente cada NFS-e emitida — sem ele,
            não é possível emitir nota fiscal como MEI.
          </p>

          <div className="space-y-14">

            {/* Seção 1 — O que é */}
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-text-1">
                Por que o certificado A1 é obrigatório?
              </h2>
              <p className="text-text-2 text-sm leading-relaxed">
                A NFS-e Nacional, padrão exigido pela Receita Federal desde 2026, utiliza
                assinatura digital baseada no padrão <strong className="text-text-1">ABRASF / XML-DSig</strong>.
                Isso garante que a nota não pode ser adulterada depois de emitida e que o emitente
                é realmente o MEI cadastrado.
              </p>
              <div className="bg-navy-700 border border-navy-600 rounded-xl p-5">
                <p className="text-text-1 font-semibold mb-3 text-sm">O certificado A1:</p>
                <ul className="space-y-2">
                  {[
                    'É um arquivo com extensão .pfx ou .p12',
                    'Fica armazenado no seu computador (não em token físico)',
                    'Tem validade de 1 ano e precisa ser renovado anualmente',
                    'Pode ser do tipo e-CPF (vinculado ao seu CPF) ou e-CNPJ (vinculado ao CNPJ do MEI)',
                    'É emitido por certificadoras autorizadas pelo ICP-Brasil',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-text-2">
                      <span className="text-brand-cyan mt-0.5 shrink-0">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Seção 2 — Onde comprar */}
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-text-1">
                Onde comprar o certificado A1?
              </h2>
              <p className="text-text-2 text-sm leading-relaxed">
                O certificado precisa ser emitido por uma certificadora credenciada pelo
                ICP-Brasil (governo federal). Abaixo as mais usadas por MEIs:
              </p>
              <div className="flex flex-col gap-3">
                {certificadoras.map(cert => (
                  <a
                    key={cert.nome}
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between gap-4 rounded-xl p-4 border transition ${
                      cert.destaque
                        ? 'bg-brand-cyan/5 border-brand-cyan/30 hover:border-brand-cyan/60'
                        : 'bg-navy-700 border-navy-600 hover:border-navy-500'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-text-1 text-sm">{cert.nome}</p>
                      <p className="text-text-2 text-xs mt-0.5">{cert.preco}</p>
                    </div>
                    {cert.destaque && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 shrink-0">
                        Gratuito
                      </span>
                    )}
                    <span className="text-text-2 text-xs shrink-0">Acessar →</span>
                  </a>
                ))}
              </div>
              <p className="text-xs text-text-2">
                Dica: compare preços direto nos sites das certificadoras — promoções são frequentes.
                O certificado e-CPF é geralmente mais barato e serve para a maioria dos MEIs.
              </p>
            </section>

            {/* Seção 3 — Como exportar */}
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-text-1">
                Como exportar o arquivo .pfx para usar no Nota Fácil MEI?
              </h2>
              <p className="text-text-2 text-sm leading-relaxed">
                Depois de comprar o certificado, a certificadora instala ele no seu navegador
                ou computador. Você precisa <strong className="text-text-1">exportar como arquivo .pfx</strong> para
                fazer o upload no Nota Fácil MEI.
              </p>

              <div className="flex flex-col gap-4">
                {[
                  {
                    n: 1,
                    title: 'Acesse o painel da certificadora',
                    desc: 'Faça login no portal onde você comprou o certificado (Certisign, Serasa, etc.) e localize a opção "Meus certificados" ou "Gerenciar certificado".',
                  },
                  {
                    n: 2,
                    title: 'Exporte o certificado',
                    desc: 'Clique em "Exportar", "Backup" ou "Fazer download". Escolha o formato PKCS#12 (.pfx ou .p12). Alguns sistemas chamam de "Arquivo de troca de informações pessoais".',
                  },
                  {
                    n: 3,
                    title: 'Defina uma senha de exportação',
                    desc: 'O sistema vai pedir uma senha para proteger o arquivo. Esta é a senha que você vai digitar no Nota Fácil MEI. Anote em local seguro — sem ela, o arquivo não pode ser usado.',
                  },
                  {
                    n: 4,
                    title: 'Salve o arquivo .pfx no computador',
                    desc: 'O arquivo vai ter extensão .pfx ou .p12. Guarde em local de fácil acesso — você vai precisar fazer upload dele uma única vez no cadastro.',
                  },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex items-start gap-4 bg-navy-700 border border-navy-600 rounded-xl p-5">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-sm font-bold flex items-center justify-center mt-0.5">
                      {n}
                    </span>
                    <div>
                      <p className="font-semibold text-text-1 text-sm mb-1">{title}</p>
                      <p className="text-text-2 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Aviso senha */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
                <span className="text-amber-400 text-lg shrink-0">⚠️</span>
                <div>
                  <p className="text-text-1 font-semibold text-sm mb-1">Guarde a senha do certificado</p>
                  <p className="text-text-2 text-xs leading-relaxed">
                    A senha que você define ao exportar é diferente da senha do portal da certificadora.
                    Sem ela, o arquivo .pfx não pode ser utilizado em nenhum sistema.
                    Anote em um gerenciador de senhas ou local seguro.
                  </p>
                </div>
              </div>
            </section>

            {/* FAQ */}
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-text-1">
                Dúvidas frequentes
              </h2>
              <div className="flex flex-col gap-3">
                {faqCert.map(({ q, a }) => (
                  <details key={q} className="bg-navy-700 border border-navy-600 rounded-xl p-5 group">
                    <summary className="font-semibold cursor-pointer list-none flex justify-between items-center gap-4 text-sm">
                      <span>{q}</span>
                      <span className="text-brand-cyan shrink-0 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="text-text-2 text-sm leading-relaxed mt-3">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div className="bg-navy-700 border border-navy-600 rounded-2xl p-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <p className="font-display font-bold text-text-1">
                  Já tem o certificado? Faça o cadastro agora.
                </p>
                <p className="text-text-2 text-sm mt-1">
                  Trial grátis · Sem cartão · Upload do certificado em 1 clique.
                </p>
              </div>
              <Link
                href="/cadastro?produto=mei&origem=certificado-a1"
                className="bg-brand-cyan text-navy-900 dark:text-[#0A0F1E] font-semibold px-6 py-2.5 rounded-lg text-sm hover:opacity-90 transition whitespace-nowrap"
              >
                Cadastrar MEI →
              </Link>
            </div>

            {/* Fonte */}
            <p className="text-xs text-text-2">
              Fonte:{' '}
              <a
                href="https://www.gov.br/iti/pt-br/assuntos/icp-brasil/autoridades-certificadoras"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-text-1 transition"
              >
                ICP-Brasil — Autoridades Certificadoras credenciadas
              </a>
            </p>

          </div>
        </div>
      </main>

      {/* Footer mínimo */}
      <footer className="border-t border-navy-600 py-6 px-4 mt-8">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-between items-center gap-3 text-xs text-text-2">
          <p>© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/mei" className="hover:text-text-1 transition">Nota Fácil MEI</Link>
            <Link href="/obrigatoriedade-nfse-mei" className="hover:text-text-1 transition">Obrigatoriedade NFS-e</Link>
            <Link href="/privacidade" className="hover:text-text-1 transition">Privacidade</Link>
            <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">Suporte</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
