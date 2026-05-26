import Link from 'next/link'

const OPCOES = [
  {
    href:     '/cadastro?produto=mei',
    titulo:   'Sou MEI',
    subtitulo: 'Microempreendedor Individual',
    desc:     'Cadastre seu MEI e emita notas em 30 segundos pelo painel, sem entender de imposto.',
    badge:    null,
    ctaLabel: 'Começar como MEI',
    primary:  true,
  },
  {
    href:     '/cadastro/me',
    titulo:   'Tenho uma ME ou EPP',
    subtitulo: 'Microempresa ou Empresa de Pequeno Porte',
    desc:     'Simples Nacional ou Lucro Presumido. NFS-e Nacional obrigatória a partir de Set/2026.',
    badge:    'Obrigatório em Set/2026',
    ctaLabel: 'Cadastrar minha empresa',
    primary:  false,
  },
  {
    href:     '/docs',
    titulo:   'Quero integrar via API',
    subtitulo: 'Desenvolvedor / Gateway',
    desc:     'Emita notas programaticamente para seus clientes via API REST com webhooks e SDKs.',
    badge:    null,
    ctaLabel: 'Ver documentação da API',
    primary:  false,
  },
]

export default function CadastroSeletor() {
  return (
    <main className="min-h-screen bg-navy-900 text-text-1 font-body flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold mb-3">
            Criar conta
          </h1>
          <p className="text-text-2 text-base">
            Escolha o tipo de empresa para continuar
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {OPCOES.map((op) => (
            <Link
              key={op.href}
              href={op.href}
              className={`group flex items-center gap-5 rounded-2xl border p-5 transition-all ${
                op.primary
                  ? 'border-brand-cyan/40 bg-brand-cyan/5 hover:border-brand-cyan/70 hover:bg-brand-cyan/10'
                  : 'border-navy-600 bg-navy-700 hover:border-brand-cyan/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-display font-bold text-text-1 text-base">
                    {op.titulo}
                  </span>
                  {op.badge && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold
                                     bg-nota-processando/10 text-nota-processando
                                     border border-nota-processando/20 rounded-full px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-nota-processando animate-pulse" />
                      {op.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-2 mb-1">{op.subtitulo}</p>
                <p className="text-sm text-text-2 leading-relaxed hidden sm:block">{op.desc}</p>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${
                  op.primary
                    ? 'bg-brand-cyan text-navy-900 group-hover:opacity-90'
                    : 'border border-navy-600 text-text-2 group-hover:border-brand-cyan group-hover:text-text-1'
                }`}
              >
                {op.ctaLabel} →
              </span>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm text-text-2 mt-8">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-cyan hover:underline font-medium">
            Entrar no painel →
          </Link>
        </p>
      </div>
    </main>
  )
}
