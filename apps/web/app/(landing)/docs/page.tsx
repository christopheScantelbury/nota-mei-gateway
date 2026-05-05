import Link from 'next/link'

const CARDS = [
  {
    href: '/docs/quickstart',
    icon: '⚡',
    title: 'Quickstart',
    desc: 'Da API Key à primeira NFS-e em menos de 5 minutos.',
    badge: 'Comece aqui',
    badgeColor: 'bg-[#00E8FF]/10 text-[#00E8FF] border-[#00E8FF]/20',
  },
  {
    href: '/docs/referencia',
    icon: '📖',
    title: 'Referência da API',
    desc: 'Documentação interativa de todos os endpoints, schemas e exemplos.',
    badge: 'Interativo',
    badgeColor: 'bg-[#7C6FFF]/10 text-[#7C6FFF] border-[#7C6FFF]/20',
  },
  {
    href: '/docs/webhooks',
    icon: '🔔',
    title: 'Webhooks',
    desc: 'Receba notificações em tempo real quando a Receita processar a nota.',
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
    desc: 'Tabela completa de códigos de erro e como tratá-los.',
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
        <h1 className="text-3xl font-bold font-outfit text-slate-900 dark:text-white">Developer Portal</h1>
        <p className="text-slate-600 dark:text-[#8AA0B8] text-lg leading-relaxed">
          Bem-vindo à documentação do{' '}
          <strong className="text-slate-900 dark:text-text-1 font-semibold">Nota MEI Gateway</strong>.
          API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.
        </p>
      </div>

      {/* Base URL */}
      <div className="bg-slate-100 dark:bg-[#142035] border border-slate-200 dark:border-[#1E3050] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-slate-500 dark:text-[#8AA0B8] uppercase tracking-wider">Base URL</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Produção', url: 'https://api.emitirnotafacil.com.br', color: 'text-[#00C85A]' },
            { label: 'Sandbox', url: 'https://sandbox.emitirnotafacil.com.br', color: 'text-[#F0B414]' },
          ].map((env) => (
            <div key={env.label} className="bg-white dark:bg-[#0A0F1E] border border-slate-200 dark:border-[#1E3050] rounded-lg p-3">
              <p className={`text-xs font-medium mb-1 ${env.color}`}>{env.label}</p>
              <code className="block text-sm text-slate-600 dark:text-[#8AA0B8] font-mono break-all">{env.url}</code>
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
            className="group bg-slate-50 hover:bg-slate-100 dark:bg-[#142035] dark:hover:bg-[#1a2940] border border-slate-200 dark:border-[#1E3050] hover:border-brand-cyan/30 rounded-xl p-5 transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{card.icon}</span>
                <h2 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-cyan transition-colors">
                  {card.title}
                </h2>
              </div>
              {card.badge && (
                <span className={`text-xs border rounded-full px-2 py-0.5 shrink-0 ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-[#8AA0B8]">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Auth snippet */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Autenticação</h2>
        <p className="text-sm text-slate-600 dark:text-[#8AA0B8]">
          Todas as rotas autenticadas exigem o header <code className="text-brand-cyan">Authorization</code>:
        </p>
        <pre className="bg-slate-100 dark:bg-[#142035] border border-slate-200 dark:border-[#1E3050] rounded-xl p-4 text-sm font-mono text-brand-cyan overflow-x-auto">
          {`Authorization: Bearer sk_live_<sua-chave>`}
        </pre>
        <p className="text-sm text-slate-600 dark:text-[#8AA0B8]">
          Use <code className="text-amber-600 dark:text-[#F0B414]">sk_test_</code> para o sandbox e{' '}
          <code className="text-emerald-600 dark:text-[#00C85A]">sk_live_</code> para produção.
          Nunca exponha suas chaves no frontend.
        </p>
      </div>
    </div>
  )
}
