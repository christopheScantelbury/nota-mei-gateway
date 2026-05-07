import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import HeroSection from '@/components/landing/HeroSection'
import SocialProof from '@/components/landing/SocialProof'
import AnimatedSection from '@/components/landing/AnimatedSection'
import UrgencyBanner from '@/components/landing/UrgencyBanner'
import HowItWorksToggle from '@/components/landing/HowItWorksToggle'
import PricingToggle from '@/components/landing/PricingToggle'

export const metadata: Metadata = {
  title: 'Emissão de NFS-e para MEI — Nota Fácil MEI & Nota MEI Gateway',
  description:
    'Emita NFS-e do seu MEI em segundos. Para MEI: app simples sem burocracia. Para devs: API REST integrada à Receita Federal Nacional. ScantelburyDevs.',
  openGraph: {
    title: 'Emissão de NFS-e para MEI — ScantelburyDevs',
    description: 'Emita NFS-e do seu MEI em segundos. Simples para o MEI, poderoso para o dev.',
    url: 'https://emitirnotafacil.com.br',
    siteName: 'Nota MEI Gateway',
    images: [{ url: '/og/og-gateway-1200x630.png', width: 1200, height: 630, alt: 'Nota MEI Gateway — Emissão de NFS-e para MEI' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Emissão de NFS-e para MEI — ScantelburyDevs',
    description: 'Emita NFS-e do seu MEI em segundos. Simples para o MEI, poderoso para o dev.',
    images: ['/og/og-gateway-1200x630.png'],
  },
  alternates: { canonical: 'https://emitirnotafacil.com.br' },
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://emitirnotafacil.com.br'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nota MEI Gateway',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: APP_URL,
  description: 'API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL', description: 'Trial gratuito de 30 dias' },
  author: { '@type': 'Organization', name: 'ScantelburyDevs', url: 'https://scantelburydevs.com.br' },
}

const faqs = [
  {
    q: 'Isso funciona para o meu MEI?',
    a: 'Sim. Se você é MEI prestador de serviços, a Nota Fácil MEI emite sua NFS-e em segundos — sem precisar entender de sistemas fiscais. Basta o certificado A1 e o e-mail do seu cliente. Para desenvolvedores, o Nota MEI Gateway oferece a mesma emissão via API REST.',
  },
  {
    q: 'Preciso de certificado digital A1?',
    a: 'Sim. O certificado A1 do seu MEI é necessário para assinar digitalmente cada nota, conforme exige o padrão ABRASF. Você faz upload uma única vez e nós armazenamos com segurança.',
  },
  {
    q: 'O trial exige cartão de crédito?',
    a: 'Não. O trial de 30 dias é completamente gratuito e não exige nenhuma forma de pagamento. Você só precisa fornecer cartão ao escolher um plano pago.',
  },
  {
    q: 'Sou desenvolvedor — como integro a API?',
    a: 'Envie um POST /v1/nfse com os dados do serviço e do tomador. Nós cuidamos do XML, assinatura digital e envio à Receita Federal. O resultado chega via webhook assinado (HMAC-SHA256) com o número da NFS-e, PDF e XML.',
  },
  {
    q: 'Vocês suportam todos os municípios brasileiros?',
    a: 'Suportamos todos os municípios que aderiram à NFS-e Nacional. Atualmente são mais de 5 000 municípios cobertos pela plataforma da Receita Federal.',
  },
  {
    q: 'O que acontece se eu ultrapassar o limite do meu plano?',
    a: 'Cada nota excedente é cobrada pela tarifa proporcional do seu plano. Você pode acompanhar o consumo em tempo real pelo painel de uso no dashboard.',
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navbar — scroll-aware, glass blur */}
      <Navbar />

      {/* Hero — product bifurcation (MEI vs API) */}
      <HeroSection />

      {/* Urgency banner — NFS-e obligation, dismissible */}
      <UrgencyBanner />

      {/* Social proof — counters, security / LGPD */}
      <SocialProof />

      {/* Como funciona */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="como-funciona">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-8">
            Como funciona
          </h2>
          <HowItWorksToggle />
        </div>
      </AnimatedSection>

      {/* Planos */}
      <AnimatedSection className="py-24 px-4" id="planos" delay={0.1}>
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Planos e preços
          </h2>
          <p className="text-text-2 text-center mb-8">
            Comece grátis. Escale conforme cresce.
          </p>
          <PricingToggle />
        </div>
      </AnimatedSection>

      {/* FAQ */}
      <AnimatedSection className="pt-24 pb-12 px-4 bg-navy-700/40" id="faq" delay={0.05}>
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
      <AnimatedSection className="pt-12 pb-24 px-4 text-center" delay={0.1}>
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-4xl font-extrabold mb-6">
            Pronto para automatizar suas notas?
          </h2>
          <p className="text-text-2 text-lg mb-8">
            30 dias grátis. Sem cartão. Cancele quando quiser.
          </p>
          <Link
            href="/cadastro"
            className="bg-brand-cyan text-navy-900 dark:text-[#0A0F1E] font-semibold px-10 py-4 rounded-xl text-lg hover:opacity-90 transition"
          >
            Criar conta gratuita
          </Link>
        </div>
      </AnimatedSection>

      <LandingFooter />

    </main>
  )
}
