import Link from 'next/link'

const CARDS = [
  {
    href: '/docs/quickstart',
    icon: '⚡',
    title: 'Quickstart',
    desc: 'Da API Key à primeira NFS-e em menos de 5 minutos.',
    badge: 'Comece aqui',
    badgeColor: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  },
  {
    href: '/docs/referencia',
    icon: '📖',
    title: 'Referência da API',
    desc: 'Documentação interativa de todos os endpoints, schemas e exemplos.',
    badge: 'Interativo',
    badgeColor: 'bg-persona-api/10 text-persona-api border-persona-api/20',
  },
  {
    href: '/docs/webhooks',
    icon: '🔔',
    title: 'Webhooks',
    desc: 'Receba notificações em tempo real quando a Receita Federal processar a nota.',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/docs/ambientes',
    icon: '🧪',
    title: 'Ambientes',
    desc: 'Diferenças entre sandbox (sk_test_) e produção (sk_live_).',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/docs/erros',
    icon: '⚠️',
    title: 'Erros',
    desc: 'Tabela completa de códigos de erro e como tratá-los — inclui E0116 universal de IM faltante.',
    badge: null,
    badgeColor: '',
  },
  {
    href: '/docs/changelog',
    icon: '📋',
    title: 'Changelog',
    desc: 'Histórico de versões e mudanças na API.',
    badge: null,
    badgeColor: '',
  },
]

export default function DocsPage() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold font-outfit text-text-1">Developer Portal</h1>
        <p className="text-text-2 text-lg leading-relaxed">
          Bem-vindo à documentação da{' '}
          <strong className="text-text-1 font-semibold">NotaFácil API</strong>.
          REST para emissão automatizada de NFS-e Nacional —{' '}
          <strong className="text-text-1">MEI, ME e EPP</strong>, conectada
          direto à Receita Federal, sem depender de prefeituras.
        </p>
      </div>

      {/* Suporte por regime */}
      <div className="bg-navy-50 border border-navy-600 rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-text-2 uppercase tracking-wider">Regimes suportados</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-nota-autorizada font-bold mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-text-1">Simples Nacional MEI</p>
              <p className="text-text-2 text-xs">CRegTribMEI=4, opSimpNac=2, ISS via DAS</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-nota-autorizada font-bold mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-text-1">Simples Nacional (ME)</p>
              <p className="text-text-2 text-xs">CRegTrib=1, ISS via DAS, sem retenção</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-nota-autorizada font-bold mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-text-1">Lucro Presumido</p>
              <p className="text-text-2 text-xs">DAM mensal, ISS por município, com retenção opcional</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-nota-autorizada font-bold mt-0.5">✓</span>
            <div>
              <p className="font-semibold text-text-1">Lucro Real (EPP)</p>
              <p className="text-text-2 text-xs">DAM mensal, ISS por município, retenção obrigatória órgão público</p>
            </div>
          </div>
        </div>
      </div>

      {/* Base URL */}
      <div className="bg-navy-50 border border-navy-600 rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-text-2 uppercase tracking-wider">Base URL</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Produção', url: 'https://api.emitirnotafacil.com.br', color: 'text-nota-autorizada' },
            { label: 'Sandbox', url: 'https://sandbox.emitirnotafacil.com.br', color: 'text-nota-processando' },
          ].map((env) => (
            <div key={env.label} className="bg-navy-700 border border-navy-600 rounded-lg p-3">
              <p className={`text-xs font-medium mb-1 ${env.color}`}>{env.label}</p>
              <code className="block text-sm text-text-2 font-mono break-all">{env.url}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group bg-navy-700 hover:bg-navy-50 dark:hover:bg-navy-700/60 border border-navy-600 hover:border-brand-blue/40 rounded-xl p-5 transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{card.icon}</span>
                <h2 className="font-semibold text-text-1 group-hover:text-brand-blue dark:group-hover:text-brand-cyan transition-colors">
                  {card.title}
                </h2>
              </div>
              {card.badge && (
                <span className={`text-xs border rounded-full px-2 py-0.5 shrink-0 ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-text-2">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Auth snippet */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-1">Autenticação</h2>
        <p className="text-sm text-text-2">
          Todas as rotas autenticadas exigem o header{' '}
          <code className="text-brand-blue dark:text-brand-cyan">Authorization</code>:
        </p>
        <pre className="bg-slate-900 dark:bg-navy-900 border border-navy-600 rounded-xl p-4 text-sm font-mono text-slate-100 overflow-x-auto">
{`Authorization: Bearer sk_live_<sua-chave>`}
        </pre>
        <p className="text-sm text-text-2">
          Use <code className="text-nota-processando">sk_test_</code> para o sandbox e{' '}
          <code className="text-nota-autorizada">sk_live_</code> para produção.
          Nunca exponha suas chaves no frontend — obtenha em{' '}
          <Link href="/login?produto=gateway" className="text-brand-blue dark:text-brand-cyan hover:underline">
            Configurações → API Keys
          </Link>{' '}
          após login.
        </p>
      </div>
    </div>
  )
}
