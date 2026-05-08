import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import EcossistemaScantelbury from '@/components/landing/EcossistemaScantelbury'
import { PlanosStructuredData } from '@/components/seo/StructuredData'

export const metadata: Metadata = {
  title: 'Planos e Preços',
  description:
    'Compare os planos do Nota MEI Gateway — de grátis a Business. Emita NFS-e de forma automatizada com preços transparentes.',
  openGraph: {
    title: 'Planos e Preços · Nota MEI Gateway',
    description: 'Planos a partir de grátis. Sem taxa de setup. Cancele quando quiser.',
  },
}

const PLANS = [
  {
    key: 'trial',
    name: 'Trial',
    price: 'Grátis',
    period: '',
    highlight: false,
    badge: null,
    limit: 5,
    features: [
      '5 notas/mês incluídas',
      'API REST completa',
      'Dashboard de gerenciamento',
      'Suporte por e-mail',
      'Certificado A1 (upload único)',
      'Webhook de eventos',
    ],
    cta: 'Começar grátis',
    ctaHref: '/cadastro',
    ctaVariant: 'secondary' as const,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 'R$ 29',
    period: '/mês',
    highlight: false,
    badge: null,
    limit: 50,
    features: [
      '50 notas/mês incluídas',
      'Excedente R$ 1,50/nota',
      'API REST completa',
      'Dashboard de gerenciamento',
      'Suporte por e-mail',
      'Certificado A1',
      'Webhook de eventos',
      'Histórico 12 meses',
    ],
    cta: 'Assinar Starter',
    ctaHref: '/cadastro',
    ctaVariant: 'secondary' as const,
  },
  {
    key: 'basic',
    name: 'Basic',
    price: 'R$ 79',
    period: '/mês',
    highlight: true,
    badge: 'Mais popular',
    limit: 200,
    features: [
      '200 notas/mês incluídas',
      'Excedente R$ 0,80/nota',
      'API REST completa',
      'Dashboard de gerenciamento',
      'Suporte prioritário',
      'Certificado A1 (renovação automática)',
      'Webhook de eventos',
      'Histórico ilimitado',
      'Templates de nota',
      'Exportação CSV',
    ],
    cta: 'Assinar Basic',
    ctaHref: '/cadastro',
    ctaVariant: 'primary' as const,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 199',
    period: '/mês',
    highlight: false,
    badge: null,
    limit: 1000,
    features: [
      '1.000 notas/mês incluídas',
      'Excedente R$ 0,30/nota',
      'Tudo do Basic',
      'Emissão recorrente automática',
      'E-mail com PDF + XML após emissão',
      'Múltiplas API Keys',
      'SLA 99,9% contratual',
      'Suporte por chat',
    ],
    cta: 'Assinar Pro',
    ctaHref: '/cadastro',
    ctaVariant: 'secondary' as const,
  },
  {
    key: 'business',
    name: 'Business',
    price: 'R$ 499',
    period: '/mês',
    highlight: false,
    badge: 'Alto volume',
    limit: 5000,
    features: [
      '5.000 notas/mês incluídas',
      'Excedente R$ 0,15/nota',
      'Tudo do Pro',
      'Integração WhatsApp (em breve)',
      'IP dedicado na Receita Federal',
      'Onboarding técnico dedicado',
      'SLA 99,9% com crédito',
      'Suporte 24/7',
    ],
    cta: 'Assinar Business',
    ctaHref: '/cadastro',
    ctaVariant: 'secondary' as const,
  },
]

const FEATURE_TABLE = [
  { feature: 'Notas incluídas/mês',       trial: '5',    starter: '50',    basic: '200',   pro: '1.000',  business: '5.000' },
  { feature: 'Excedente por nota',         trial: '—',    starter: 'R$ 1,50', basic: 'R$ 0,80', pro: 'R$ 0,30', business: 'R$ 0,15' },
  { feature: 'API REST completa',          trial: '✓',    starter: '✓',    basic: '✓',     pro: '✓',      business: '✓' },
  { feature: 'Dashboard',                  trial: '✓',    starter: '✓',    basic: '✓',     pro: '✓',      business: '✓' },
  { feature: 'Webhook de eventos',         trial: '✓',    starter: '✓',    basic: '✓',     pro: '✓',      business: '✓' },
  { feature: 'Certificado A1',             trial: '✓',    starter: '✓',    basic: 'Auto',  pro: 'Auto',   business: 'Auto' },
  { feature: 'Templates de nota',          trial: '—',    starter: '—',    basic: '✓',     pro: '✓',      business: '✓' },
  { feature: 'Emissão recorrente',         trial: '—',    starter: '—',    basic: '—',     pro: '✓',      business: '✓' },
  { feature: 'E-mail com PDF/XML',         trial: '—',    starter: '—',    basic: '—',     pro: '✓',      business: '✓' },
  { feature: 'Múltiplas API Keys',         trial: '1',    starter: '3',    basic: '5',     pro: '10',     business: 'Ilimitadas' },
  { feature: 'Histórico de notas',         trial: '3 meses', starter: '12 meses', basic: 'Ilimitado', pro: 'Ilimitado', business: 'Ilimitado' },
  { feature: 'SLA contratual',             trial: '—',    starter: '—',    basic: '—',     pro: '99,9%',  business: '99,9% + crédito' },
  { feature: 'Suporte',                    trial: 'E-mail', starter: 'E-mail', basic: 'Prioritário', pro: 'Chat', business: '24/7' },
]

const FAQ = [
  {
    q: 'O Trial requer cartão de crédito?',
    a: 'Não. O plano Trial é completamente gratuito e não exige cadastro de método de pagamento. Você só adiciona um cartão ao fazer upgrade para um plano pago.',
  },
  {
    q: 'O que acontece quando ultrapasso o limite?',
    a: 'Emissões acima do limite do plano são cobradas como excedente, conforme a tabela de preços do plano contratado. Você será notificado quando atingir 80% e 100% do limite.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Você pode cancelar pelo dashboard em Plano & Faturamento → Gerenciar Plano. O acesso continua até o fim do período já pago. Não há multa por cancelamento antecipado.',
  },
  {
    q: 'Como funciona o certificado A1?',
    a: 'O certificado digital A1 (.pfx/.p12) é necessário para assinar os XMLs de NFS-e. Você faz o upload uma vez no cadastro. Ele é armazenado cifrado no AWS Secrets Manager e nunca é salvo em disco.',
  },
  {
    q: 'O serviço funciona com todos os municípios?',
    a: 'Funciona com todos os municípios que aderiram ao Sistema Nacional NFS-e da Receita Federal. Consulte a lista atualizada em nfse.gov.br. Municípios com sistema próprio não são suportados.',
  },
  {
    q: 'Posso usar o Trial para homologação/teste?',
    a: 'Sim. O Trial usa o ambiente de homologação da Receita Federal por padrão, sem emissão de notas reais. Basta alterar o endpoint para produção ao contratar um plano pago.',
  },
]

// Planos para JSON-LD ItemList (Google rich snippet em SERPs).
// Mantém em sincronia com PLANS acima — preço numérico para schema.
const planosSeo = [
  { nome: 'Trial',    descricao: '5 notas/mês incluídas, API completa', precoBRL:    0 },
  { nome: 'Starter',  descricao: '50 notas/mês, suporte por e-mail',     precoBRL:   29 },
  { nome: 'Basic',    descricao: '200 notas/mês, suporte prioritário',   precoBRL:   79 },
  { nome: 'Pro',      descricao: '1.000 notas/mês, SLA 99.9%',           precoBRL:  199 },
  { nome: 'Business', descricao: '5.000 notas/mês, SLA dedicado',        precoBRL:  499 },
]

export default function PrecosPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1">
      <PlanosStructuredData planos={planosSeo} />
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-16 pt-28">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-brand-cyan/8 border border-brand-cyan/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
            <span className="text-sm text-brand-cyan font-medium">Preços transparentes, sem surpresas</span>
          </div>
          <h1 className="font-display text-5xl font-extrabold mb-4">
            Planos para cada volume
          </h1>
          <p className="text-text-2 text-lg max-w-xl mx-auto">
            De freelancers a agências. Comece de graça, escale conforme cresce.
            Sem taxa de setup, sem fidelidade mínima.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={[
                'rounded-xl border flex flex-col p-5 relative',
                plan.highlight
                  ? 'border-brand-cyan bg-brand-cyan/5 shadow-glow-cyan'
                  : 'border-navy-600 bg-navy-700',
              ].join(' ')}
            >
              {plan.badge && (
                <span
                  className={[
                    'absolute -top-3 left-4 text-xs font-semibold rounded-full px-3 py-1',
                    plan.highlight
                      ? 'bg-brand-cyan text-navy-900'
                      : 'bg-nota-upgrade text-white',
                  ].join(' ')}
                >
                  {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <p className="font-semibold text-text-1 mb-1">{plan.name}</p>
                <div className="flex items-end gap-1">
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  {plan.period && <span className="text-text-2 text-sm mb-1">{plan.period}</span>}
                </div>
                <p className="text-xs text-text-2 mt-1">Até {plan.limit.toLocaleString('pt-BR')} notas/mês</p>
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-text-2">
                    <span className="text-brand-cyan mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={[
                  'block text-center text-sm font-semibold px-4 py-2 rounded-lg transition',
                  plan.ctaVariant === 'primary'
                    ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
                    : 'bg-navy-600 text-text-1 hover:bg-navy-600/70',
                ].join(' ')}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <section className="mb-20">
          <h2 className="font-display text-3xl font-extrabold text-center mb-10">
            Comparativo completo
          </h2>
          <div className="overflow-x-auto rounded-xl border border-navy-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-700 border-b border-navy-600">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider w-48">
                    Recurso
                  </th>
                  {['Trial', 'Starter', 'Basic', 'Pro', 'Business'].map((p) => (
                    <th
                      key={p}
                      className={[
                        'px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider',
                        p === 'Basic' ? 'text-brand-cyan' : 'text-text-2',
                      ].join(' ')}
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_TABLE.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={[
                      'border-b border-navy-600 last:border-0',
                      i % 2 === 0 ? 'bg-navy-900/30' : '',
                    ].join(' ')}
                  >
                    <td className="px-5 py-3 text-text-2">{row.feature}</td>
                    {(['trial', 'starter', 'basic', 'pro', 'business'] as const).map((k) => (
                      <td
                        key={k}
                        className={[
                          'px-3 py-3 text-center',
                          row[k] === '—' ? 'text-navy-600' : 'text-text-1',
                          row[k] === '✓' ? 'text-nota-autorizada' : '',
                          k === 'basic' ? 'font-medium' : '',
                        ].join(' ')}
                      >
                        {row[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-2xl mx-auto mb-20">
          <h2 className="font-display text-3xl font-extrabold text-center mb-10">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-xl border border-navy-600 bg-navy-700 p-5"
              >
                <p className="font-semibold text-text-1 mb-2">{item.q}</p>
                <p className="text-sm text-text-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center py-12 rounded-2xl border border-navy-600 bg-navy-700">
          <h2 className="font-display text-3xl font-extrabold mb-3">
            Pronto para automatizar suas notas?
          </h2>
          <p className="text-text-2 mb-8 max-w-md mx-auto">
            Crie sua conta gratuita agora. Integração em menos de 30 minutos.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/cadastro"
              className="bg-brand-cyan text-navy-900 font-bold px-8 py-3 rounded-lg hover:opacity-90 transition"
            >
              Começar grátis →
            </Link>
            <Link
              href="/docs"
              className="bg-navy-600 text-text-1 font-semibold px-8 py-3 rounded-lg hover:bg-navy-600/70 transition"
            >
              Ver documentação
            </Link>
          </div>
        </div>
      </div>

      <EcossistemaScantelbury />

      <LandingFooter />
    </main>
  )
}
