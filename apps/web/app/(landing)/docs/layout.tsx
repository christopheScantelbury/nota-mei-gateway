'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from '@/components/ui/ThemeToggle'

const NAV = [
  { href: '/docs',             label: 'Visão geral',    exact: true },
  { href: '/docs/quickstart',  label: 'Quickstart' },
  { href: '/docs/referencia',  label: 'Referência da API' },
  { href: '/docs/webhooks',    label: 'Webhooks' },
  { href: '/docs/ambientes',   label: 'Ambientes' },
  { href: '/docs/erros',       label: 'Erros' },
  { href: '/docs/changelog',   label: 'Changelog' },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <div className="min-h-screen bg-navy-900 text-text-1">
      {/* Top bar */}
      <header className="border-b border-navy-600 bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold font-display text-brand-cyan">
              Nota MEI
            </Link>
            <span className="text-navy-600">|</span>
            <span className="text-sm text-text-2">Developer Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sandbox"
              className="text-sm text-text-2 hover:text-brand-cyan transition-colors"
            >
              Sandbox
            </Link>
            <Link
              href="https://notameigateway.com.br/cadastro"
              className="text-sm px-4 py-1.5 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan rounded-lg transition-colors"
            >
              Criar conta
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 py-8 pr-6 sticky top-[53px] h-[calc(100vh-53px)] overflow-y-auto">
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'block px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive(item.href, item.exact)
                    ? 'bg-brand-cyan/10 text-brand-cyan font-medium'
                    : 'text-text-2 hover:text-text-1 hover:bg-navy-700',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t border-navy-600 space-y-1">
            <p className="px-3 text-xs font-medium text-text-2 uppercase tracking-wider mb-2">
              SDKs
            </p>
            {[
              { label: 'Node.js / TypeScript', href: 'https://www.npmjs.com/package/@scantelburydevs/notamei' },
              { label: 'Python', href: 'https://pypi.org/project/notamei-gateway/' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg text-sm text-text-2 hover:text-text-1 hover:bg-navy-700 transition-colors"
              >
                {item.label} ↗
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <main id="main-content" className="flex-1 min-w-0 py-8 pl-8 border-l border-navy-600">
          {children}
        </main>
      </div>
    </div>
  )
}
