import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import AnimatedSection from '@/components/landing/AnimatedSection'
import NavbarGateway from '@/components/landing/NavbarGateway'

export const metadata: Metadata = {
  title: 'Nota MEI Gateway — A API de NFS-e para seu produto',
  description:
    'Integre emissão de nota fiscal de MEI ao seu SaaS, ERP ou marketplace com um POST. Conexão direta com a Receita Federal Nacional. Trial grátis.',
  openGraph: {
    title: 'Nota MEI Gateway — A API de NFS-e para seu produto',
    description: 'Emita NFS-e de MEI via API REST. Um POST, webhook, PDF e XML automáticos.',
    url: 'https://notameigateway.com.br',
    siteName: 'Nota MEI Gateway',
    images: [{ url: '/og/og-gateway-1200x630.png', width: 1200, height: 630, alt: 'Nota MEI Gateway — API de NFS-e para MEI' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nota MEI Gateway — A API de NFS-e para seu produto',
    description: 'Emita NFS-e de MEI via API REST. Um POST, webhook, PDF e XML automáticos.',
    images: ['/og/og-gateway-1200x630.png'],
  },
  alternates: { canonical: 'https://emitirnotafacil.com.br/gateway' },
}

const curlSnippet = `curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tomador": {
      "cnpj": "12345678000190",
      "razao_social": "Cliente LTDA"
    },
    "servico": {
      "descricao": "Consultoria em software",
      "valor": 1500.00,
      "codigo_nbs": "01.01.01.10"
    },
    "webhook_url": "https://meusite.com/webhooks/nfse"
  }'`

const apiPlans = [
  {
    name: 'Dev',
    price: 'R$ 59',
    period: '/mês',
    limit: '200 notas + sandbox',
    desc: 'Desenvolvedor solo, prototipagem e MVPs.',
    extra: 'R$ 0,50 por nota acima do limite',
    cta: 'Criar conta de teste',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 'R$ 119',
    period: '/mês',
    limit: '500 notas/mês',
    desc: 'Agências e pequenos SaaS em produção.',
    extra: 'R$ 0,35 por nota acima do limite',
    cta: 'Assinar Pro',
    highlight: true,
  },
  {
    name: 'Business',
    price: 'R$ 249',
    period: '/mês',
    limit: '2.000 notas/mês',
    desc: 'Plataformas e marketplaces estabelecidos.',
    extra: 'R$ 0,20 por nota acima do limite',
    cta: 'Assinar Business',
    highlight: false,
  },
  {
    name: 'Scale',
    price: 'Sob consulta',
    period: '',
    limit: '10.000+ notas/mês',
    desc: 'High volume, SLA dedicado, suporte prioritário.',
    extra: null,
    cta: 'Falar com vendas',
    highlight: false,
  },
]

const infraStack = [
  { name: 'Supabase',   color: '#3ECF8E' },
  { name: 'Railway',    color: '#7C3AED' },
  { name: 'AWS KMS',    color: '#FF9900' },
  { name: 'Stripe',     color: '#635BFF' },
  { name: 'RabbitMQ',   color: '#FF6600' },
  { name: 'Vercel',     color: '#FFFFFF' },
  { name: 'Prometheus', color: '#E6522C' },
]

type SdkPackage = { type: 'package'; name: string; subtitle: string; install: string; docsHref: string }
type SdkAccess  = { type: 'access';  name: string; subtitle: string; cadastroHref: string }
type Sdk = SdkPackage | SdkAccess

const sdks: Sdk[] = [
  { type: 'package', name: 'Node.js',     subtitle: 'TypeScript · Mantido oficialmente',        install: 'npm install @notamei/gateway', docsHref: '/docs' },
  { type: 'package', name: 'Python',      subtitle: 'Python 3.10+ · Mantido oficialmente',      install: 'pip install notamei',           docsHref: '/docs' },
  { type: 'access',  name: 'WooCommerce', subtitle: 'Plugin WordPress · Instalação em 1 clique', cadastroHref: '/cadastro?produto=gateway&origem=sdk-woocommerce' },
  { type: 'access',  name: 'Zapier',      subtitle: 'No-code · 6.000+ integrações',               cadastroHref: '/cadastro?produto=gateway&origem=sdk-zapier' },
]

const faqs = [
  {
    q: 'Quanto tempo leva para integrar?',
    a: 'Em média uma tarde. A API segue padrões REST com JSON. Você faz um POST, recebe 202 Accepted com nota_id, e o resultado chega via webhook assinado. Há SDKs prontos para Node.js e Python.',
  },
  {
    q: 'A API funciona em modo sandbox?',
    a: 'Sim. O ambiente sandbox usa a URL de homologação da Receita Federal e não emite notas reais. Perfeito para integrar, testar e validar sem custo.',
  },
  {
    q: 'Como funciona a autenticação?',
    a: 'Bearer token — chave sk_live_ (produção) ou sk_test_ (sandbox) no header Authorization. As chaves são geradas no dashboard e nunca ficam em texto puro no banco de dados.',
  },
  {
    q: 'E se a Receita Federal rejeitar a nota?',
    a: 'O webhook entrega o evento nfse.rejeitada com o código e descrição exata do erro da Receita. Você corrige e resubmete. Há também endpoint GET /v1/nfse/:id para polling de status.',
  },
  {
    q: 'Suportam todos os municípios?',
    a: 'Suportamos os 5.000+ municípios aderentes à NFS-e Nacional. Prefeituras com sistema próprio não são cobertas — mas a tendência é de migração total para o sistema federal.',
  },
  {
    q: 'Existe rate limit?',
    a: 'Sliding window por API key: 100 req/min no plano Dev, 500 req/min no Pro, 2.000 req/min no Business. Headers X-RateLimit-* em cada resposta.',
  },
]

export default function GatewayLandingPage() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body">
      <NavbarGateway />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="mx-auto max-w-6xl flex flex-col lg:flex-row items-start gap-12">
          {/* Texto */}
          <div className="flex-1">
            <span className="inline-block bg-navy-700 border border-navy-600 text-brand-cyan text-xs font-semibold px-3 py-1 rounded-full mb-6">
              Nota MEI Gateway — by ScantelburyDevs
            </span>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-5">
              A API de NFS-e que{' '}
              <span className="text-brand-cyan">seu produto precisa.</span>
            </h1>
            <p className="text-text-2 text-xl mb-4 leading-relaxed">
              Integre emissão de nota fiscal de MEI ao seu SaaS, ERP ou marketplace
              com um POST. Conexão direta com a Receita Federal Nacional, sem depender
              de prefeituras.
            </p>
            <p className="text-text-2 text-base mb-8 italic">
              &ldquo;Construa em uma tarde o que levaria 3 meses lendo manual da ABRASF.&rdquo;
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/docs"
                className="bg-brand-cyan text-navy-900 font-semibold px-8 py-4 rounded-xl text-lg hover:opacity-90 transition text-center"
              >
                Ler a documentação
              </Link>
              <Link
                href="/cadastro?produto=gateway"
                className="border border-navy-600 text-text-1 font-semibold px-8 py-4 rounded-xl text-lg hover:border-brand-cyan transition text-center"
              >
                Criar conta de teste
              </Link>
            </div>
            <p className="text-text-2 text-sm mt-4">
              Trial grátis · Sandbox incluso · Sem cartão de crédito
            </p>
          </div>

          {/* Code snippet */}
          <div className="flex-1 w-full">
            <div className="bg-navy-700 border border-navy-600 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-navy-600 bg-navy-900/50">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-2 text-text-2 text-xs font-mono">POST /v1/nfse</span>
              </div>
              <pre className="p-5 text-xs font-mono text-text-2 overflow-x-auto leading-relaxed">
                <code>{curlSnippet}</code>
              </pre>
            </div>
            <div className="mt-3 bg-nota-autorizada/10 border border-nota-autorizada/30 rounded-xl px-4 py-3">
              <p className="text-xs font-mono text-nota-autorizada">
                {'{'} &quot;nota_id&quot;: &quot;uuid&quot;, &quot;status&quot;: &quot;PROCESSANDO&quot; {'}'}
              </p>
              <p className="text-text-2 text-xs mt-1">
                → webhook <span className="text-nota-autorizada">nfse.autorizada</span> chega em segundos com PDF + XML
              </p>
            </div>
          </div>
        </div>
      </section>

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
                title: 'Cadastre o MEI',
                desc: 'Crie a conta, faça upload do certificado A1 e receba sua API Key (sk_live_ ou sk_test_) em segundos.',
              },
              {
                step: '02',
                title: 'Emita via POST',
                desc: 'Um POST /v1/nfse com tomador, serviço e webhook_url. A gente assina o XML, manda pra Receita e devolve 202 Accepted.',
              },
              {
                step: '03',
                title: 'Receba via webhook',
                desc: 'Evento nfse.autorizada assinado (HMAC-SHA256) com número da NFS-e, links de PDF e XML direto no seu endpoint.',
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

      {/* Segurança */}
      <AnimatedSection className="py-24 px-4" delay={0.1}>
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Segurança &amp; Conformidade
          </h2>
          <p className="text-text-2 text-center mb-16">
            Infraestrutura pensada para compliance fiscal desde o primeiro dia.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { icon: '🔒', label: 'Certificado A1 nunca em disco', desc: 'Armazenado e decriptado em memória via AWS Secrets Manager. Zero exposição em disco ou logs.' },
              { icon: '🛡️', label: 'API Keys hasheadas (SHA-256)',  desc: 'A chave real nunca é armazenada no banco. Apenas o hash irreversível.' },
              { icon: '⚖️', label: 'Conforme LGPD',                desc: 'Dados processados exclusivamente em servidores no Brasil (sa-east-1).' },
              { icon: '🔐', label: 'mTLS com a Receita Federal',   desc: 'Conexão mutuamente autenticada com o sistema oficial NFS-e Nacional v1.2.' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex gap-4 bg-navy-700 border border-navy-600 rounded-xl p-5">
                <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="font-semibold text-sm text-text-1">{label}</p>
                  <p className="text-text-2 text-xs mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Infraestrutura */}
      <AnimatedSection className="py-16 px-4 bg-navy-700/40" delay={0.05}>
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-6">
          <p className="text-text-2 text-xs font-semibold uppercase tracking-widest">
            Infraestrutura de nível enterprise
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {infraStack.map(({ name, color }) => (
              <span
                key={name}
                className="inline-flex items-center gap-2 bg-navy-700 border border-navy-600 rounded-full px-4 py-2 text-sm font-semibold text-text-2"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Por que não construir você mesmo? — Task 6 */}
      <AnimatedSection className="py-24 px-4" delay={0.05}>
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Construa em 1 tarde o que levaria 6 meses.
          </h2>
          <p className="text-text-2 text-center mb-16">
            A Receita Federal não tem API amigável. Nós traduzimos isso pra você.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Integração direta — coluna vermelha */}
            <div className="bg-navy-900 border border-nota-rejeitada/30 rounded-2xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-nota-rejeitada font-bold text-lg">✕</span>
                <p className="font-semibold text-text-1">Integração direta com a Receita Federal</p>
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  '3–6 meses de desenvolvimento',
                  'Manter biblioteca ABRASF atualizada',
                  'Gerenciar certificado A1 com segurança',
                  'Lidar com variações por município',
                  'Monitorar uptime do serviço federal',
                  'Suporte quando a Receita muda o padrão',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-2">
                    <span className="text-nota-rejeitada mt-0.5 shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Gateway — coluna verde */}
            <div className="bg-navy-900 border border-nota-autorizada/30 rounded-2xl p-7">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-nota-autorizada font-bold text-lg">✓</span>
                <p className="font-semibold text-text-1">Nota MEI Gateway</p>
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  'Integrado em 1 tarde com o SDK',
                  'Atualizações automáticas quando a Receita muda',
                  'Certificado gerenciado com AWS KMS',
                  '5.000+ municípios cobertos',
                  '99,9% uptime SLA monitorado',
                  'Suporte técnico em português',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-text-2">
                    <span className="text-nota-autorizada mt-0.5 shrink-0">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* SDKs — Tasks 1, 2, 3 */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" delay={0.1}>
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Integre em qualquer linguagem
          </h2>
          <p className="text-text-2 text-center mb-12">
            Bibliotecas oficiais mantidas pela ScantelburyDevs.
            Suporte garantido. Atualizações automáticas com cada versão da API.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sdks.map((sdk) => (
              <div
                key={sdk.name}
                className="bg-navy-700 border border-navy-600 rounded-xl p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-x-2 gap-y-1 flex-wrap">
                  <p className="font-display font-bold text-text-1">{sdk.name}</p>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-nota-autorizada/10 text-nota-autorizada border border-nota-autorizada/20 shrink-0">
                    Oficial
                  </span>
                </div>
                <p className="text-text-2 text-xs">{sdk.subtitle}</p>
                {sdk.type === 'package' ? (
                  <>
                    <div className="bg-navy-900 rounded-lg px-3 py-2 overflow-x-auto">
                      <code className="text-xs font-mono text-brand-cyan whitespace-nowrap">
                        {sdk.install}
                      </code>
                    </div>
                    <Link
                      href={sdk.docsHref}
                      className="text-xs text-brand-cyan font-semibold hover:underline mt-auto"
                    >
                      Ver documentação →
                    </Link>
                  </>
                ) : (
                  <>
                    {/* Spacer para alinhar com os cards de package */}
                    <div className="flex-1" />
                  <Link
                    href={sdk.cadastroHref}
                    className="text-center text-sm font-semibold py-2 rounded-lg border border-navy-600 text-text-1 hover:border-brand-cyan transition"
                  >
                    Acessar SDK →
                  </Link>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* CTA abaixo dos SDKs — Task 3 */}
          <div className="mt-12 text-center">
            <p className="text-sm text-text-2 mb-4">Precisa de uma linguagem não listada?</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href="/cadastro?produto=gateway"
                className="bg-brand-cyan text-navy-900 font-semibold px-6 py-2.5 rounded-lg text-sm hover:opacity-90 transition"
              >
                Criar conta e acessar SDKs →
              </Link>
              <Link
                href="/docs/sdks"
                className="border border-navy-600 text-text-1 font-semibold px-6 py-2.5 rounded-lg text-sm hover:border-brand-cyan transition"
              >
                Ver documentação completa
              </Link>
            </div>
            <p className="text-xs text-text-2 mt-4">
              Todos os SDKs inclusos em qualquer plano · Suporte técnico garantido
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* Preços */}
      <AnimatedSection className="py-24 px-4 bg-navy-700/40" id="precos" delay={0.1}>
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            Preços
          </h2>
          <p className="text-text-2 text-center mb-16">
            Sandbox sempre incluso. Escale conforme cresce.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {apiPlans.map((plan) => (
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
                  {plan.period && <span className="text-text-2 text-sm">{plan.period}</span>}
                </div>
                <p className="text-brand-cyan text-sm font-semibold">{plan.limit}</p>
                {plan.extra && <p className="text-text-2 text-xs">{plan.extra}</p>}
                <Link
                  href={
                    plan.name === 'Scale'
                      ? 'mailto:vendas@notameigateway.com.br'
                      : `/cadastro?produto=gateway&plano=${plan.name.toLowerCase()}`
                  }
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
      <AnimatedSection className="py-24 px-4" id="faq" delay={0.05}>
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
            Pronto para integrar?
          </h2>
          <p className="text-text-2 text-lg mb-8">
            Sandbox grátis. Documentação completa. Sem surpresa na fatura.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs"
              className="bg-brand-cyan text-navy-900 font-semibold px-10 py-4 rounded-xl text-lg hover:opacity-90 transition"
            >
              Ler a documentação
            </Link>
            <Link
              href="/cadastro?produto=gateway"
              className="border border-navy-600 text-text-1 font-semibold px-10 py-4 rounded-xl text-lg hover:border-brand-cyan transition"
            >
              Testar no sandbox
            </Link>
          </div>
          <p className="text-text-2 text-sm mt-6">
            Dúvidas de integração?{' '}
            <a href="mailto:dev@notameigateway.com.br" className="underline hover:text-text-1 transition">
              dev@notameigateway.com.br
            </a>
          </p>
        </div>
      </AnimatedSection>

      {/* Footer — 3 colunas */}
      <footer className="border-t border-navy-600 py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-10">
            {/* Marca */}
            <div className="sm:col-span-1 flex flex-col gap-3">
              <Link href="/gateway" className="inline-flex items-center">
                <Image
                  src="/logos/gateway-logo-navbar-dark.svg"
                  alt="Nota MEI Gateway"
                  width={140}
                  height={34}
                  className="h-7 w-auto dark:block hidden"
                />
                <Image
                  src="/logos/gateway-logo-navbar-light.svg"
                  alt="Nota MEI Gateway"
                  width={140}
                  height={34}
                  className="h-7 w-auto block dark:hidden"
                />
              </Link>
              <p className="text-text-2 text-xs leading-relaxed">
                A API de NFS-e para devs e plataformas.<br />
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
                <li><Link href="/gateway#precos" className="hover:text-text-1 transition">Planos e preços</Link></li>
              </ul>
            </div>

            {/* Desenvolvedores */}
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-2 mb-4">
                Desenvolvedores
              </h4>
              <ul className="flex flex-col gap-2.5 text-sm text-text-2">
                <li><Link href="/docs"            className="hover:text-text-1 transition">Documentação</Link></li>
                <li><Link href="/docs/quickstart" className="hover:text-text-1 transition">Quickstart</Link></li>
                <li><Link href="/docs/sdks"       className="hover:text-text-1 transition">SDKs</Link></li>
                <li><Link href="/sandbox"         className="hover:text-text-1 transition">Sandbox</Link></li>
                <li><Link href="/status"          className="hover:text-text-1 transition">Status da API</Link></li>
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
                <li>
                  <a href="mailto:suporte@emitirnotafacil.com.br" className="hover:text-text-1 transition">
                    Suporte
                  </a>
                </li>
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
