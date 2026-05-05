import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import AnimatedSection from '@/components/landing/AnimatedSection'
import UrgencyBanner from '@/components/landing/UrgencyBanner'
import NavbarMei from '@/components/landing/NavbarMei'
import PricingToggleMei from '@/components/landing/PricingToggleMei'
import TimeSavingsCalculator from '@/components/landing/TimeSavingsCalculator'

export const metadata: Metadata = {
  title: 'Nota Fácil MEI — Emita sua NFS-e em 30 segundos',
  description:
    'Emita nota fiscal de MEI sem burocracia, sem prefeitura, sem dor de cabeça. Pelo celular. Trial grátis, sem cartão de crédito.',
  openGraph: {
    title: 'Nota Fácil MEI — Emita sua NFS-e em 30 segundos',
    description: 'Nota fiscal de MEI sem complicação. Você preenche 3 campos, a gente cuida do resto.',
    url: 'https://notafacilmei.com.br',
    siteName: 'Nota Fácil MEI',
    images: [{ url: '/og/og-nfm-1200x630.png', width: 1200, height: 630, alt: 'Nota Fácil MEI — Emita sua NFS-e em 30 segundos' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nota Fácil MEI — Emita sua NFS-e em 30 segundos',
    description: 'Nota fiscal de MEI sem complicação. Você preenche 3 campos, a gente cuida do resto.',
    images: ['/og/og-nfm-1200x630.png'],
  },
  alternates: { canonical: 'https://emitirnotafacil.com.br/mei' },
}

const faqs = [
  {
    q: 'Eu sou obrigado a emitir nota como MEI?',
    a: 'Sim, se você presta serviços. A Receita Federal tornou obrigatória a emissão de NFS-e pela plataforma nacional para todos os MEI prestadores de serviço. A Nota Fácil MEI já está integrada a esse sistema.',
  },
  {
    q: 'O que é certificado digital A1 e onde consigo?',
    a: (
      <>
        É uma assinatura eletrônica obrigatória para emitir notas fiscais. Você pode adquirir em certificadoras credenciadas (Certisign, Serasa, etc.) por cerca de R$ 100–200/ano — ou gratuitamente na Receita Federal para e-CPF.{' '}
        <Link href="/certificado-a1" className="text-brand-cyan hover:underline">
          Veja o guia completo →
        </Link>
      </>
    ),
  },
  {
    q: 'Posso emitir nota para pessoa física (CPF)?',
    a: 'Sim. Você pode emitir nota para CPF (pessoa física) ou CNPJ (empresa). Basta informar o documento do tomador na emissão.',
  },
  {
    q: 'E se eu errar uma nota, posso cancelar?',
    a: 'Sim. Notas autorizadas podem ser canceladas em até 7 dias. Depois disso, é necessário emitir uma nota de substituição — a gente também facilita esse processo.',
  },
  {
    q: 'Vocês declaram meu DAS também?',
    a: 'Não. A Nota Fácil MEI cuida só da emissão de NFS-e. O DAS (guia mensal do MEI) é gerado separado pelo Portal do Empreendedor. Mas a gente avisa quando está perto do vencimento.',
  },
  {
    q: 'Funciona para MEI de qualquer cidade?',
    a: 'Funciona em todos os municípios que aderiram à NFS-e Nacional — mais de 5.000 cidades. Se a sua cidade ainda usa sistema próprio, informamos no cadastro.',
  },
]

export default function MeiLandingPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <NavbarMei />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-center gap-12">
          {/* Texto */}
          <div className="flex-1 text-center lg:text-left">
            <span className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-6">
              Nota Fácil MEI — by ScantelburyDevs
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-5">
              Sua nota fiscal de MEI{' '}
              <span className="text-brand-cyan">emitida em 30 segundos.</span>{' '}
              Pelo celular.
            </h1>
            <p className="text-text-2 text-lg mb-8 leading-relaxed">
              Sem precisar entender de imposto, sem prefeitura, sem dor de cabeça.
              A gente cuida do resto — você só preenche o nome do cliente e o valor.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/cadastro?produto=mei"
                className="bg-brand-cyan text-navy-900 font-semibold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition text-center"
              >
                Emitir minha primeira nota grátis
              </Link>
              <a
                href="#como-funciona"
                className="border border-navy-600 text-text-1 font-semibold px-8 py-4 rounded-xl text-lg hover:border-brand-cyan transition text-center"
              >
                Ver como funciona (1 min)
              </a>
            </div>
            <p className="text-text-2 text-sm mt-4">
              Sem cartão de crédito · Cancele quando quiser
            </p>
          </div>

          {/* Mockup de celular */}
          <div className="flex-shrink-0 w-full max-w-xs mx-auto lg:mx-0">
            <div className="relative bg-navy-700 border border-navy-600 rounded-3xl p-5 shadow-glow-cyan">
              {/* Prévia badge */}
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-navy-600 border border-navy-600 text-text-2 text-[10px] font-semibold px-3 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                Prévia do app
              </span>
              <div className="w-16 h-1.5 bg-navy-600 rounded-full mx-auto mb-5" />
              <p className="text-brand-cyan text-xs font-semibold mb-4 text-center uppercase tracking-widest">
                Nova Nota Fiscal
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Nome do cliente', placeholder: 'Ex: João Silva' },
                  { label: 'Descrição do serviço', placeholder: 'Ex: Consultoria em TI' },
                  { label: 'Valor (R$)', placeholder: 'Ex: 1.500,00' },
                ].map(({ label, placeholder }) => (
                  <div key={label}>
                    <p className="text-text-2 text-xs mb-1">{label}</p>
                    <div className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-text-2 text-xs">
                      {placeholder}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/cadastro?produto=mei"
                className="mt-5 block w-full bg-brand-cyan text-navy-900 text-sm font-bold py-3 rounded-xl text-center hover:opacity-90 transition"
              >
                Emitir nota →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Urgency banner */}
      <UrgencyBanner />

      {/* Como funciona */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="como-funciona">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Como funciona
          </h2>
          <p className="text-text-2 text-center mb-16">Três passos. Sem complicação.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                emoji: '📋',
                title: 'Cadastre seu MEI',
                desc: 'Informe seu CNPJ e envie seu certificado digital. A gente guia você passo a passo — leva menos de 5 minutos.',
              },
              {
                step: '02',
                emoji: '✏️',
                title: 'Emita pelo app ou pelo site',
                desc: 'Nome do cliente, descrição do serviço e valor. Pronto. Não precisa entender de código tributário ou ISS.',
              },
              {
                step: '03',
                emoji: '📩',
                title: 'Receba a nota no e-mail',
                desc: 'O PDF e o XML chegam automáticos em segundos. Você manda para o cliente em um clique.',
              },
            ].map(({ step, emoji, title, desc }) => (
              <div key={step} className="bg-navy-700 border border-navy-600 rounded-2xl p-6 text-center">
                <span className="text-4xl">{emoji}</span>
                <span className="block text-brand-cyan font-mono text-xs font-bold mt-3 mb-1">{step}</span>
                <h3 className="font-display text-lg font-bold mb-3">{title}</h3>
                <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Por que confiar */}
      <AnimatedSection className="py-24 px-4" delay={0.1}>
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Por que confiar na gente?
          </h2>
          <p className="text-text-2 text-center mb-16">
            Seus dados fiscais merecem o mesmo cuidado que um banco.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                icon: '🔒',
                title: 'Seguro igual banco',
                desc: 'Seu certificado fica criptografado com AWS KMS. Ninguém, nem nossa equipe, acessa o conteúdo.',
              },
              {
                icon: '⚖️',
                title: 'Aprovado pela Receita Federal',
                desc: 'Conexão direta com o sistema oficial da NFS-e Nacional. Cada nota é assinada digitalmente conforme a lei.',
              },
              {
                icon: '🌎',
                title: '100% brasileiro',
                desc: 'Seus dados nunca saem do território nacional. Operamos em conformidade com a LGPD.',
              },
              {
                icon: '💬',
                title: 'Suporte de gente, em português',
                desc: 'WhatsApp (47) 99735-2380, e-mail, atendimento humano. Nada de robô. Respondemos em até 4 horas úteis.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 bg-navy-700 border border-navy-600 rounded-xl p-5">
                <span className="text-3xl shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-text-1 mb-1">{title}</p>
                  <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Calculadora de economia de tempo — #161 */}
      <AnimatedSection className="py-24 px-4" id="calculadora" delay={0.05}>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Quanto tempo você perde com nota fiscal?
          </h2>
          <p className="text-text-2 text-center mb-12">
            Emitir pelo sistema da prefeitura leva ~30 minutos por nota.<br />
            Com a Nota Fácil MEI, leva 30 segundos. Veja a diferença.
          </p>
          <TimeSavingsCalculator />
        </div>
      </AnimatedSection>

      {/* Preços — #160 toggle anual */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="precos" delay={0.1}>
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Preços feitos para MEI
          </h2>
          <p className="text-text-2 text-center mb-8">
            Comece grátis. Pague apenas pelo que usar.
          </p>
          <PricingToggleMei />
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection className="pt-24 pb-12 px-4 scroll-mt-20" id="faq" delay={0.05}>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-16">
            Perguntas frequentes
          </h2>
          <div className="flex flex-col gap-4">
            {faqs.map(({ q, a }) => (
              <details key={q} className="bg-navy-700 border border-navy-600 rounded-xl p-5 group">
                <summary className="font-semibold cursor-pointer list-none flex justify-between items-center gap-4">
                  <span>{q}</span>
                  <span className="text-brand-cyan text-lg shrink-0 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-text-2 text-sm leading-relaxed mt-3">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* CTA final */}
      <AnimatedSection className="pt-12 pb-24 px-4 text-center" delay={0.1}>
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-4xl font-extrabold mb-6">
            Pronto pra parar de perder tempo com nota fiscal?
          </h2>
          <p className="text-text-2 text-lg mb-8">
            Trial grátis por 30 dias — 5 notas no trial, sem custo. Sem cartão. Cancele quando quiser.
          </p>
          <Link
            href="/cadastro?produto=mei"
            className="bg-brand-cyan text-navy-900 font-semibold px-10 py-4 rounded-xl text-lg hover:opacity-90 transition"
          >
            Começar grátis — trial de 30 dias
          </Link>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <a
              href="https://wa.me/5547997352380"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-navy-600 text-text-2 text-sm font-medium px-5 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
            >
              <span>💬</span> WhatsApp (47) 99735-2380
            </a>
            <a
              href="mailto:suporte@emitirnotafacil.com.br"
              className="flex items-center justify-center gap-2 border border-navy-600 text-text-2 text-sm font-medium px-5 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
            >
              <span>✉️</span> suporte@emitirnotafacil.com.br
            </a>
          </div>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t border-navy-600 py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-10">
            {/* Marca */}
            <div className="sm:col-span-1 flex flex-col gap-3">
              <Link href="/mei" className="inline-flex items-center">
                <Image
                  src="/logos/nfm-logo-navbar-dark-clean.svg"
                  alt="Nota Fácil MEI"
                  width={140}
                  height={38}
                  className="h-8 w-auto dark:block hidden"
                />
                <Image
                  src="/logos/nfm-logo-navbar-light.svg"
                  alt="Nota Fácil MEI"
                  width={140}
                  height={38}
                  className="h-8 w-auto block dark:hidden"
                />
              </Link>
              <p className="text-text-2 text-xs leading-relaxed">
                Emissão de NFS-e simples para MEI.<br />
                Build · Migrate · Innovate.
              </p>
            </div>

            {/* Produtos */}
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
                Produtos
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-text-2">
                <li><Link href="/mei"          className="hover:text-text-1 transition">Nota Fácil MEI</Link></li>
                <li><Link href="/gateway"      className="hover:text-text-1 transition">Nota MEI Gateway</Link></li>
                <li><Link href="/mei#precos"   className="hover:text-text-1 transition">Planos e preços</Link></li>
                <li><Link href="/status"       className="hover:text-text-1 transition">Status da API</Link></li>
              </ul>
            </div>

            {/* Suporte */}
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
                Suporte
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-text-2">
                <li>
                  <a
                    href="https://wa.me/5547997352380"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-text-1 transition"
                  >
                    💬 WhatsApp (47) 99735-2380
                  </a>
                </li>
                <li>
                  <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">
                    ✉️ suporte@emitirnotafacil.com.br
                  </a>
                </li>
              </ul>
            </div>

            {/* Empresa */}
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
                Empresa
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-text-2">
                <li>
                  <a href="https://scantelburydevs.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-text-1 transition">
                    ScantelburyDevs
                  </a>
                </li>
                <li><Link href="/privacidade" className="hover:text-text-1 transition">Privacidade</Link></li>
                <li><Link href="/termos"      className="hover:text-text-1 transition">Termos de uso</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-navy-600 pt-6 text-center text-xs text-text-2">
            © {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </main>
  )
}
