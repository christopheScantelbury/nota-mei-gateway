import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import SocialProof from '@/components/landing/SocialProof'
import AnimatedSection from '@/components/landing/AnimatedSection'

export const metadata: Metadata = {
  title: 'Nota MEI Gateway — Emissão de NFS-e para MEI',
  description:
    'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional. Trial gratuito de 30 dias, sem cartão de crédito.',
  openGraph: {
    title: 'Nota MEI Gateway',
    description: 'Emita NFS-e para o seu MEI em segundos via API.',
    url: 'https://notameigateway.com.br',
    siteName: 'Nota MEI Gateway',
    images: [{ url: '/brand/og-image.png', width: 1200, height: 630 }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nota MEI Gateway',
    description: 'Emita NFS-e para o seu MEI em segundos via API.',
    images: ['/brand/og-image.png'],
  },
  alternates: { canonical: 'https://notameigateway.com.br' },
}

const plans = [
  {
    name: 'Trial',
    price: 'Grátis',
    period: '30 dias',
    limit: '5 notas/mês',
    description: 'Para experimentar sem compromisso.',
    cta: 'Começar grátis',
    highlight: false,
  },
  {
    name: 'Starter',
    price: 'R$ 29',
    period: '/mês',
    limit: '50 notas/mês',
    description: 'Para freelancers com baixo volume.',
    cta: 'Assinar Starter',
    highlight: false,
  },
  {
    name: 'Basic',
    price: 'R$ 59',
    period: '/mês',
    limit: '200 notas/mês',
    description: 'Para MEIs com fluxo regular de serviços.',
    cta: 'Assinar Basic',
    highlight: true,
  },
  {
    name: 'Pro',
    price: 'R$ 119',
    period: '/mês',
    limit: '500 notas/mês',
    description: 'Para desenvolvedores e agências.',
    cta: 'Assinar Pro',
    highlight: false,
  },
  {
    name: 'Business',
    price: 'R$ 249',
    period: '/mês',
    limit: '2 000 notas/mês',
    description: 'Para plataformas e alto volume.',
    cta: 'Assinar Business',
    highlight: false,
  },
]

const faqs = [
  {
    q: 'O que é o Nota MEI Gateway?',
    a: 'É uma API REST que automatiza a emissão de NFS-e para MEI diretamente na Receita Federal Nacional (NFS-e Nacional v1.2), sem precisar acessar sistemas municipais individualmente.',
  },
  {
    q: 'Preciso de certificado digital A1?',
    a: 'Sim. O certificado A1 do seu MEI é necessário para assinar digitalmente cada nota, conforme exige o padrão ABRASF. Você faz upload uma única vez e nós armazenamos com segurança via AWS KMS.',
  },
  {
    q: 'O trial exige cartão de crédito?',
    a: 'Não. O trial de 30 dias é completamente gratuito e não exige nenhuma forma de pagamento. Você só precisa fornecer cartão ao escolher um plano pago.',
  },
  {
    q: 'Como funciona o webhook?',
    a: 'Após a nota ser autorizada ou rejeitada pela Receita Federal, enviamos um POST assinado (HMAC-SHA256) para a URL de webhook que você configurar na requisição. O payload inclui o número da NFS-e e links para PDF e XML.',
  },
  {
    q: 'Vocês suportam todos os municípios brasileiros?',
    a: 'Suportamos todos os municípios que aderiram à NFS-e Nacional. Atualmente são mais de 5 000 municípios cobertos pela plataforma da Receita Federal.',
  },
  {
    q: 'O que acontece se eu ultrapassar o limite do meu plano?',
    a: 'Cada nota excedente é cobrada pela tarifa proporcional do seu plano via Stripe. Você pode acompanhar o consumo em tempo real pelo endpoint GET /v1/billing/usage.',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">

      {/* Navbar — scroll-aware, glass blur */}
      <Navbar />

      {/* Hero — staggered entrance animations */}
      <HeroSection />

      {/* Social proof — counters, infra logos, security / LGPD */}
      <SocialProof />

      {/* Como funciona */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="como-funciona">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-16">
            Como funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Cadastre seu MEI',
                desc: 'Crie sua conta, faça upload do certificado A1 e receba sua API Key em segundos.',
              },
              {
                step: '02',
                title: 'Emita via API',
                desc: 'Envie um POST /v1/nfse com os dados do tomador e serviço. Nós cuidamos do XML, assinatura e envio à Receita.',
              },
              {
                step: '03',
                title: 'Receba o resultado',
                desc: 'Quando a nota for autorizada, um webhook assinado entrega o número da NFS-e, PDF e XML direto no seu sistema.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-navy-700 border border-navy-600 rounded-2xl p-6">
                <span className="text-brand-cyan font-mono text-sm font-bold">{step}</span>
                <h3 className="font-display text-xl font-bold mt-2 mb-3">{title}</h3>
                <p className="text-text-2 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Planos */}
      <AnimatedSection className="py-24 px-4" id="planos" delay={0.1}>
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Planos e preços
          </h2>
          <p className="text-text-2 text-center mb-16">
            Comece grátis. Escale conforme cresce.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {plans.map((plan) => (
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
                  <p className="text-text-2 text-xs mt-1">{plan.description}</p>
                </div>
                <div>
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  <span className="text-text-2 text-sm">{plan.period}</span>
                </div>
                <p className="text-brand-cyan text-sm font-semibold">{plan.limit}</p>
                <Link
                  href="/cadastro"
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
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="faq" delay={0.05}>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-16">
            Perguntas frequentes
          </h2>
          <div className="flex flex-col gap-4">
            {faqs.map(({ q, a }) => (
              <details
                key={q}
                className="bg-navy-700 border border-navy-600 rounded-xl p-5 group"
              >
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
            Pronto para automatizar suas notas?
          </h2>
          <p className="text-text-2 text-lg mb-8">
            30 dias grátis. Sem cartão. Cancele quando quiser.
          </p>
          <Link
            href="/cadastro"
            className="bg-brand-cyan text-navy-900 font-semibold px-10 py-4 rounded-xl text-lg hover:opacity-90 transition"
          >
            Criar conta gratuita
          </Link>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="border-t border-navy-600 py-10 px-4">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between gap-6 text-text-2 text-sm">
          <div>
            <p className="font-display font-bold text-text-1 mb-1">Nota MEI Gateway</p>
            <p>© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
          </div>
          <div className="flex gap-6 items-center flex-wrap">
            <a href="/docs"                                className="hover:text-text-1 transition">Documentação</a>
            <a href="/privacidade"                         className="hover:text-text-1 transition">Privacidade</a>
            <a href="/termos"                              className="hover:text-text-1 transition">Termos de uso</a>
            <a href="mailto:suporte@notameigateway.com.br" className="hover:text-text-1 transition">Suporte</a>
          </div>
        </div>
      </footer>

    </main>
  )
}
