import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/landing/Navbar'
import LandingFooter from '@/components/landing/LandingFooter'
import { PlanosStructuredData } from '@/components/seo/StructuredData'

export const metadata: Metadata = {
  title: 'Planos e Preços — NotaFácil',
  description:
    'Planos para MEI a partir de R$ 2,90/nota. Planos para ME e EPP a partir de R$ 29/mês. Sem taxa de setup, sem fidelidade mínima.',
  openGraph: {
    title: 'Planos e Preços · NotaFácil',
    description: 'MEI: a partir de R$ 2,90/nota. Empresa: a partir de R$ 29/mês. Preços transparentes.',
  },
}

// ── MEI plans ────────────────────────────────────────────────────────────────

const PLANS_MEI = [
  {
    key: 'trial',
    name: 'Trial',
    price: 'Grátis',
    period: '',
    limit: '5 notas no trial',
    desc: 'Para experimentar sem compromisso.',
    extra: null,
    highlight: false,
    cta: 'Começar grátis',
    ctaHref: '/cadastro?produto=mei',
  },
  {
    key: 'avulso',
    name: 'Avulso',
    price: 'R$ 2,90',
    period: '/nota',
    limit: 'Sem mensalidade',
    desc: 'Pague só quando emitir. Sem compromisso mensal.',
    extra: null,
    highlight: false,
    cta: 'Emitir nota avulsa',
    ctaHref: '/cadastro?produto=mei&plano=avulso',
  },
  {
    key: 'mensal',
    name: 'MEI Mensal',
    price: 'R$ 19',
    period: '/mês',
    limit: '30 notas/mês',
    desc: 'Para quem emite toda semana com clientes fixos.',
    extra: 'Excedente R$ 0,80/nota',
    highlight: true,
    cta: 'Assinar MEI Mensal',
    ctaHref: '/cadastro?produto=mei&plano=mensal',
  },
  {
    key: 'plus',
    name: 'MEI Plus',
    price: 'R$ 39',
    period: '/mês',
    limit: '100 notas/mês',
    desc: 'Para MEI com fluxo intenso de serviços.',
    extra: 'Excedente R$ 0,50/nota',
    highlight: false,
    cta: 'Assinar MEI Plus',
    ctaHref: '/cadastro?produto=mei&plano=plus',
  },
]

// ── Empresa / API plans ──────────────────────────────────────────────────────
// Preços confirmados: billing/page.tsx + PricingToggle "Sou dev" + PricingToggleGateway

const PLANS_EMPRESA = [
  {
    key: 'trial',
    name: 'Trial',
    price: 'Grátis',
    period: '',
    limit: '5 notas no trial',
    highlight: false,
    badge: null,
    features: [
      '5 notas/mês incluídas',
      'Dashboard de gerenciamento',
      'Certificado A1 (upload único)',
      'Suporte por e-mail',
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
    limit: '50 notas/mês',
    highlight: false,
    badge: null,
    features: [
      '50 notas/mês incluídas',
      'Excedente R$ 1,50/nota',
      'API REST completa',
      'Dashboard de gerenciamento',
      'Webhook de eventos',
      'Histórico 12 meses',
      'Suporte por e-mail',
    ],
    cta: 'Assinar Starter',
    ctaHref: '/cadastro',
    ctaVariant: 'secondary' as const,
  },
  {
    key: 'basic',
    name: 'Basic',
    price: 'R$ 59',
    period: '/mês',
    limit: '200 notas/mês',
    highlight: true,
    badge: 'Mais popular',
    features: [
      '200 notas/mês incluídas',
      'Excedente R$ 0,80/nota',
      'API REST completa',
      'Dashboard de gerenciamento',
      'Webhook de eventos',
      'Histórico ilimitado',
      'Templates de nota',
      'Exportação CSV',
      'Suporte prioritário',
    ],
    cta: 'Assinar Basic',
    ctaHref: '/cadastro',
    ctaVariant: 'primary' as const,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'R$ 119',
    period: '/mês',
    limit: '500 notas/mês',
    highlight: false,
    badge: null,
    features: [
      '500 notas/mês incluídas',
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
    price: 'R$ 249',
    period: '/mês',
    limit: '2.000 notas/mês',
    highlight: false,
    badge: 'Alto volume',
    features: [
      '2.000 notas/mês incluídas',
      'Excedente R$ 0,15/nota',
      'Tudo do Pro',
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

// ── Feature comparison table (Empresa / API plans) ───────────────────────────

const FEATURE_TABLE = [
  { feature: 'Notas incluídas/mês',   trial: '5',    starter: '50',      basic: '200',       pro: '500',       business: '2.000' },
  { feature: 'Excedente por nota',    trial: '—',    starter: 'R$ 1,50', basic: 'R$ 0,80',   pro: 'R$ 0,30',   business: 'R$ 0,15' },
  { feature: 'API REST completa',     trial: '✓',    starter: '✓',       basic: '✓',         pro: '✓',         business: '✓' },
  { feature: 'Dashboard',             trial: '✓',    starter: '✓',       basic: '✓',         pro: '✓',         business: '✓' },
  { feature: 'Webhook de eventos',    trial: '✓',    starter: '✓',       basic: '✓',         pro: '✓',         business: '✓' },
  { feature: 'Templates de nota',     trial: '—',    starter: '—',       basic: '✓',         pro: '✓',         business: '✓' },
  { feature: 'Emissão recorrente',    trial: '—',    starter: '—',       basic: '—',         pro: '✓',         business: '✓' },
  { feature: 'E-mail com PDF/XML',    trial: '—',    starter: '—',       basic: '—',         pro: '✓',         business: '✓' },
  { feature: 'Múltiplas API Keys',    trial: '1',    starter: '3',       basic: '5',         pro: '10',        business: 'Ilimitadas' },
  { feature: 'Histórico de notas',    trial: '3m',   starter: '12m',     basic: 'Ilimitado', pro: 'Ilimitado', business: 'Ilimitado' },
  { feature: 'SLA contratual',        trial: '—',    starter: '—',       basic: '—',         pro: '99,9%',     business: '99,9%+crédito' },
  { feature: 'Suporte',               trial: 'E-mail', starter: 'E-mail', basic: 'Prioritário', pro: 'Chat',  business: '24/7' },
]

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Qual a diferença entre planos MEI e Empresa?',
    a: 'Os planos MEI (Avulso, Mensal, Plus) são para Microempreendedores Individuais que emitem notas pelo painel, com preços simples por nota ou por mês. Os planos Empresa (Starter a Business) são para ME, EPP e desenvolvedores que integram via API, com volumes maiores e recursos avançados como webhooks e múltiplas API Keys.',
  },
  {
    q: 'O Trial requer cartão de crédito?',
    a: 'Não. O Trial é completamente gratuito e não exige cadastro de método de pagamento. Você só adiciona um cartão ao fazer upgrade para um plano pago.',
  },
  {
    q: 'O que acontece quando ultrapasso o limite mensal?',
    a: 'Emissões acima do limite são cobradas como excedente conforme a tarifa do seu plano. Você é notificado quando atingir 80% e 100% do limite pelo dashboard.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Cancele pelo dashboard em Plano & Faturamento → Gerenciar Plano. O acesso continua até o fim do período já pago. Sem multa por cancelamento antecipado.',
  },
  {
    q: 'Como funciona o certificado digital A1?',
    a: 'O certificado A1 (.pfx/.p12) é necessário para assinar os XMLs de NFS-e. Você faz o upload uma vez no cadastro. Ele é armazenado cifrado no AWS Secrets Manager e nunca é salvo em disco.',
  },
  {
    q: 'O serviço cobre todos os municípios?',
    a: 'Sim — todos os municípios aderentes ao Sistema Nacional NFS-e da Receita Federal (5.000+). Municípios com sistema próprio não são suportados.',
  },
]

// ── JSON-LD ───────────────────────────────────────────────────────────────────

const planosSeo = [
  { nome: 'Trial MEI',     descricao: '5 notas/mês, gratuito',               precoBRL:   0 },
  { nome: 'Avulso MEI',    descricao: 'Por nota emitida, sem mensalidade',    precoBRL:   3 },
  { nome: 'MEI Mensal',    descricao: '30 notas/mês para MEI',                precoBRL:  19 },
  { nome: 'MEI Plus',      descricao: '100 notas/mês para MEI',               precoBRL:  39 },
  { nome: 'Starter',       descricao: '50 notas/mês, ME/EPP e API',           precoBRL:  29 },
  { nome: 'Basic',         descricao: '200 notas/mês, ME/EPP e API',          precoBRL:  59 },
  { nome: 'Pro',           descricao: '500 notas/mês, SLA 99,9%',             precoBRL: 119 },
  { nome: 'Business',      descricao: '2.000 notas/mês, suporte 24/7',        precoBRL: 249 },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrecosPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <PlanosStructuredData planos={planosSeo} />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 pt-28">

        {/* ── Hero ── */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-brand-cyan/10 border border-brand-cyan/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
            <span className="text-sm text-brand-cyan font-medium">Preços transparentes, sem surpresas</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold mb-4">
            Planos para cada perfil
          </h1>
          <p className="text-text-2 text-lg max-w-xl mx-auto mb-8">
            MEI? Comece grátis e pague por nota.
            Empresa ou dev? Escalamos com você.
            Sem taxa de setup, sem fidelidade.
          </p>
          {/* Atalhos de segmento */}
          <div className="flex gap-3 justify-center flex-wrap">
            <a
              href="#mei"
              className="flex items-center gap-2 bg-navy-700 border border-navy-600 hover:border-brand-cyan text-text-1 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              📱 Sou MEI
            </a>
            <a
              href="#empresa"
              className="flex items-center gap-2 bg-navy-700 border border-navy-600 hover:border-nota-upgrade text-text-1 text-sm font-semibold px-5 py-2.5 rounded-xl transition"
            >
              🏢 Sou ME / EPP / Dev
            </a>
          </div>
        </div>

        {/* ── Seção MEI ── */}
        <section id="mei" className="mb-24 scroll-mt-24">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-cyan" />
            <h2 className="font-display text-2xl font-extrabold">Planos MEI</h2>
          </div>
          <p className="text-text-2 text-sm mb-8 ml-5">
            Para Microempreendedores Individuais. Emita pelo painel, sem precisar de programação.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS_MEI.map((plan) => (
              <div
                key={plan.key}
                className={[
                  'rounded-xl border flex flex-col p-5 relative',
                  plan.highlight
                    ? 'border-brand-cyan bg-brand-cyan/5 shadow-glow-cyan'
                    : 'border-navy-600 bg-navy-700',
                ].join(' ')}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-4 text-xs font-semibold rounded-full px-3 py-1 bg-brand-cyan text-navy-900">
                    Mais popular
                  </span>
                )}
                <div className="mb-4">
                  <p className="font-semibold text-text-1 mb-1">{plan.name}</p>
                  <p className="text-text-2 text-xs leading-relaxed">{plan.desc}</p>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="font-display text-3xl font-extrabold">{plan.price}</span>
                  {plan.period && <span className="text-text-2 text-sm mb-1">{plan.period}</span>}
                </div>
                <p className="text-brand-cyan text-xs font-semibold mb-1">{plan.limit}</p>
                {plan.extra && <p className="text-text-2 text-xs mb-4">{plan.extra}</p>}
                <Link
                  href={plan.ctaHref}
                  className={[
                    'mt-auto block text-center text-sm font-semibold px-4 py-2.5 rounded-lg transition',
                    plan.highlight
                      ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
                      : 'bg-navy-600 text-text-1 hover:bg-navy-600/70',
                  ].join(' ')}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <p className="text-text-2 text-xs text-center mt-4">
            Trial de 30 dias incluso · Sem cartão de crédito ·{' '}
            <Link href="/mei" className="text-brand-cyan hover:underline">
              Saiba mais sobre o Nota Fácil MEI →
            </Link>
          </p>
        </section>

        {/* ── Seção Empresa / API ── */}
        <section id="empresa" className="mb-20 scroll-mt-24">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-nota-upgrade" />
            <h2 className="font-display text-2xl font-extrabold">Planos ME / EPP e API</h2>
          </div>
          <p className="text-text-2 text-sm mb-8 ml-5">
            Para Microempresas, EPP e desenvolvedores que integram via API REST. NFS-e Nacional obrigatória a partir de set/2026.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {PLANS_EMPRESA.map((plan) => (
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
                  <p className="text-xs text-brand-cyan font-semibold mt-1">{plan.limit}</p>
                </div>
                <ul className="flex-1 space-y-1.5 mb-5">
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
                    'block text-center text-sm font-semibold px-4 py-2.5 rounded-lg transition',
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

          <p className="text-text-2 text-xs text-center">
            Trial de 30 dias incluso · Sandbox sempre disponível · Sem cartão de crédito ·{' '}
            <Link href="/me" className="text-nota-upgrade hover:underline">
              Saiba mais sobre ME/EPP →
            </Link>
            {' '}·{' '}
            <Link href="/gateway" className="text-nota-upgrade hover:underline">
              Saiba mais sobre a API →
            </Link>
          </p>
        </section>

        {/* ── Feature comparison table (Empresa / API) ── */}
        <section className="mb-20">
          <h2 className="font-display text-2xl font-extrabold text-center mb-2">
            Comparativo — Planos Empresa / API
          </h2>
          <p className="text-text-2 text-sm text-center mb-8">Detalhes de cada recurso por plano.</p>
          <div className="overflow-x-auto rounded-xl border border-navy-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-700 border-b border-navy-600">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider w-44">
                    Recurso
                  </th>
                  {(['Trial', 'Starter', 'Basic', 'Pro', 'Business'] as const).map((p) => (
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
                    className={['border-b border-navy-600 last:border-0', i % 2 === 0 ? 'bg-navy-900/30' : ''].join(' ')}
                  >
                    <td className="px-5 py-3 text-text-2 text-xs">{row.feature}</td>
                    {(['trial', 'starter', 'basic', 'pro', 'business'] as const).map((k) => (
                      <td
                        key={k}
                        className={[
                          'px-3 py-3 text-center text-xs',
                          row[k] === '—' ? 'text-navy-600' : 'text-text-1',
                          row[k] === '✓' ? 'text-nota-autorizada font-bold' : '',
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

        {/* ── FAQ ── */}
        <section className="max-w-2xl mx-auto mb-20">
          <h2 className="font-display text-3xl font-extrabold text-center mb-10">
            Perguntas frequentes
          </h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-navy-600 bg-navy-700 p-5">
                <p className="font-semibold text-text-1 mb-2">{item.q}</p>
                <p className="text-sm text-text-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <div className="text-center py-12 rounded-2xl border border-navy-600 bg-navy-700">
          <h2 className="font-display text-3xl font-extrabold mb-3">
            Pronto para começar?
          </h2>
          <p className="text-text-2 mb-8 max-w-md mx-auto">
            Trial grátis para qualquer perfil. Sem cartão. Cancele quando quiser.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/cadastro?produto=mei"
              className="bg-brand-cyan text-navy-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm"
            >
              📱 Começar como MEI →
            </Link>
            <Link
              href="/cadastro"
              className="bg-nota-upgrade text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition text-sm"
            >
              🏢 Começar como Empresa →
            </Link>
          </div>
        </div>

      </div>

      <LandingFooter />
    </main>
  )
}
