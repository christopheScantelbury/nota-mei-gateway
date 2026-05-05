import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import AnimatedSection from '@/components/landing/AnimatedSection'
import UrgencyBanner from '@/components/landing/UrgencyBanner'
import NavbarMei from '@/components/landing/NavbarMei'

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

const meiPlans = [
  {
    name: 'Trial',
    price: 'Grátis',
    period: '30 dias',
    limit: '5 notas no trial',
    desc: 'Para experimentar sem compromisso.',
    extra: null,
    cta: 'Começar grátis',
    highlight: false,
  },
  {
    name: 'Avulso',
    price: 'R$ 2,90',
    period: '/nota',
    limit: 'Sem mensalidade',
    desc: 'Para quem emite pouco ou de forma esporádica.',
    extra: 'R$ 2,90 por nota',
    cta: 'Emitir nota',
    highlight: false,
  },
  {
    name: 'MEI Mensal',
    price: 'R$ 19',
    period: '/mês',
    limit: '30 notas/mês',
    desc: 'Para quem emite todo mês com regularidade.',
    extra: 'R$ 0,80 por nota acima do limite',
    cta: 'Assinar agora',
    highlight: true,
  },
  {
    name: 'MEI Plus',
    price: 'R$ 39',
    period: '/mês',
    limit: '100 notas/mês',
    desc: 'Para MEI com fluxo regular de serviços.',
    extra: 'R$ 0,50 por nota acima do limite',
    cta: 'Assinar agora',
    highlight: false,
  },
]

const faqs = [
  {
    q: 'Eu sou obrigado a emitir nota como MEI?',
    a: 'Sim, se você presta serviços. A Receita Federal tornou obrigatória a emissão de NFS-e pela plataforma nacional para todos os MEI prestadores de serviço. A Nota Fácil MEI já está integrada a esse sistema.',
  },
  {
    q: 'O que é certificado digital A1 e onde consigo?',
    a: 'É uma assinatura eletrônica obrigatória para emitir notas fiscais. Você pode adquirir em cartórios ou empresas credenciadas (Certisign, Serasa, etc.) por cerca de R$ 100–200/ano. A gente te guia passo a passo no cadastro.',
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
                desc: 'WhatsApp, e-mail, atendimento humano. Nada de robô. Nossa equipe responde em até 4 horas úteis.',
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

      {/* Preços */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="precos" delay={0.1}>
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Preços feitos para MEI
          </h2>
          <p className="text-text-2 text-center mb-16">
            Comece grátis. Pague apenas pelo que usar.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {meiPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border flex flex-col gap-4 ${
                  plan.highlight
                    ? 'bg-brand-cyan/10 border-brand-cyan ring-1 ring-brand-cyan'
                    : 'bg-navy-700 border-navy-600'
                }`}
              >
                {plan.highlight && (
                  <span className="text-xs font-bold text-brand-cyan bg-brand-cyan/20 px-2 py-0.5 rounded-full self-start">
                    Mais popular
                  </span>
                )}
                <div>
                  <p className="font-display font-extrabold text-lg">{plan.name}</p>
                  <p className="text-text-2 text-xs mt-1">{plan.desc}</p>
                </div>
                <div>
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-text-2 text-sm">{plan.period}</span>
                </div>
                <p className="text-brand-cyan text-sm font-semibold">{plan.limit}</p>
                {plan.extra && (
                  <p className="text-text-2 text-xs">{plan.extra}</p>
                )}
                <Link
                  href={`/cadastro?produto=mei&plano=${plan.name.toLowerCase().replace(' ', '-')}`}
                  className={`mt-auto text-center text-sm font-semibold py-2.5 rounded-lg transition ${
                    plan.highlight
                      ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
                      : 'border border-navy-600 text-text-1 hover:border-brand-cyan'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection className="py-24 px-4 scroll-mt-20" id="faq" delay={0.05}>
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
      <AnimatedSection className="py-24 px-4 text-center" delay={0.1}>
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
          <p className="text-text-2 text-sm mt-6">
            Tem dúvida?{' '}
            <a href="mailto:suporte@notafacilmei.com.br" className="underline hover:text-text-1 transition">
              Fale com a gente por e-mail
            </a>
          </p>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t border-navy-600 py-10 px-4">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between gap-6 text-text-2 text-sm">
          <div className="flex flex-col gap-2">
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
            <p className="text-xs">© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
            <p className="text-xs">
              Também é desenvolvedor?{' '}
              <Link href="/gateway" className="underline hover:text-text-1 transition">
                Ver Nota MEI Gateway (API)
              </Link>
            </p>
          </div>
          <div className="flex gap-6 items-center flex-wrap">
            <Link href="/"              className="hover:text-text-1 transition">Início</Link>
            <Link href="/privacidade"   className="hover:text-text-1 transition">Privacidade</Link>
            <Link href="/termos"        className="hover:text-text-1 transition">Termos de uso</Link>
            <Link href="/status"        className="hover:text-text-1 transition">Status</Link>
            <a href="mailto:suporte@notafacilmei.com.br" className="hover:text-text-1 transition">Suporte</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
