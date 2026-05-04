import type { Metadata } from 'next'
import Link from 'next/link'
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

const curlSnippet = `curl -X POST https://api.notameigateway.com.br/v1/nfse \\
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

const sdks = [
  { name: 'Node.js',   href: 'https://github.com/christopheScantelbury/nota-mei-gateway', lang: 'TypeScript' },
  { name: 'Python',    href: 'https://github.com/christopheScantelbury/nota-mei-gateway', lang: 'Python 3.10+' },
  { name: 'WooCommerce', href: 'https://github.com/christopheScantelbury/nota-mei-gateway', lang: 'PHP' },
  { name: 'Zapier',    href: 'https://github.com/christopheScantelbury/nota-mei-gateway', lang: 'No-code' },
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
              "Construa em uma tarde o que levaria 3 meses lendo manual da ABRASF."
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

      {/* SDKs */}
      <AnimatedSection className="py-24 px-4" delay={0.1}>
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-3xl font-extrabold text-center mb-4">
            SDKs disponíveis
          </h2>
          <p className="text-text-2 text-center mb-12">
            Open source. Contribuições bem-vindas.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sdks.map(({ name, href, lang }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-navy-700 border border-navy-600 rounded-xl p-5 hover:border-brand-cyan transition-colors group"
              >
                <p className="font-display font-bold text-text-1 group-hover:text-brand-cyan transition-colors">
                  {name}
                </p>
                <p className="text-text-2 text-xs mt-1">{lang}</p>
                <p className="text-brand-cyan text-xs mt-3">Ver no GitHub →</p>
              </a>
            ))}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      {/* Footer */}
      <footer className="border-t border-navy-600 py-10 px-4">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between gap-6 text-text-2 text-sm">
          <div>
            <p className="font-display font-bold text-text-1 mb-1">Nota MEI Gateway</p>
            <p>© {new Date().getFullYear()} ScantelburyDevs. Todos os direitos reservados.</p>
            <p className="mt-1">
              É MEI e quer uma solução simples?{' '}
              <Link href="/mei" className="underline hover:text-text-1 transition">
                Ver Nota Fácil MEI
              </Link>
            </p>
          </div>
          <div className="flex gap-6 items-center flex-wrap">
            <Link href="/"                className="hover:text-text-1 transition">Início</Link>
            <a    href="/docs"            className="hover:text-text-1 transition">Documentação</a>
            <Link href="/status"          className="hover:text-text-1 transition">Status da API</Link>
            <Link href="/privacidade"     className="hover:text-text-1 transition">Privacidade</Link>
            <Link href="/termos"          className="hover:text-text-1 transition">Termos</Link>
            <a href="mailto:dev@notameigateway.com.br" className="hover:text-text-1 transition">Contato</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
