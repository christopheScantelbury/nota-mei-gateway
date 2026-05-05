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
        <h1 className="text-3xl font-bold font-outfit">Developer Portal</h1>
        <p className="text-[#8AA0B8] text-lg leading-relaxed">
          Bem-vindo à documentação do <strong className="text-[#EEF4FF]">Nota MEI Gateway</strong>.
          API REST para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.
        </p>
      </div>

      {/* Base URL */}
      <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-[#8AA0B8] uppercase tracking-wider">Base URL</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Produção', url: 'https://api.emitirnotafacil.com.br', color: 'text-[#00C85A]' },
            { label: 'Sandbox', url: 'https://sandbox.emitirnotafacil.com.br', color: 'text-[#F0B414]' },
          ].map((env) => (
            <div key={env.label} className="bg-[#0A0F1E] border border-[#1E3050] rounded-lg p-3">
              <p className={`text-xs font-medium mb-1 ${env.color}`}>{env.label}</p>
              <code className="block text-sm text-[#8AA0B8] font-mono break-all">{env.url}</code>
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
            className="group bg-[#142035] hover:bg-[#1a2940] border border-[#1E3050] hover:border-[#00E8FF]/30 rounded-xl p-5 transition-all space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{card.icon}</span>
                <h2 className="font-semibold group-hover:text-[#00E8FF] transition-colors">
                  {card.title}
                </h2>
              </div>
              {card.badge && (
                <span className={`text-xs border rounded-full px-2 py-0.5 shrink-0 ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>
            <p className="text-sm text-[#8AA0B8]">{card.desc}</p>
          </Link>
        ))}
      </div>

      {/* Auth snippet */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Autenticação</h2>
        <p className="text-sm text-[#8AA0B8]">
          Todas as rotas autenticadas exigem o header <code className="text-[#00E8FF]">Authorization</code>:
        </p>
        <pre className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 text-sm font-mono text-[#00E8FF] overflow-x-auto">
          {`Authorization: Bearer sk_live_<sua-chave>`}
        </pre>
        <p className="text-sm text-[#8AA0B8]">
          Use <code className="text-[#F0B414]">sk_test_</code> para o sandbox e{' '}
          <code className="text-[#00C85A]">sk_live_</code> para produção.
          Nunca exponha suas chaves no frontend.
        </p>
      </div>
    </div>
  )
}
