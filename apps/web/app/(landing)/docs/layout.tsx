'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'

const NAV = [
  { href: '/docs',            label: 'Visão geral',    exact: true },
  { href: '/docs/quickstart', label: 'Quickstart' },
  { href: '/docs/referencia', label: 'Referência da API' },
  { href: '/docs/webhooks',   label: 'Webhooks' },
  { href: '/docs/ambientes',  label: 'Ambientes' },
  { href: '/docs/erros',      label: 'Erros' },
  { href: '/docs/changelog',  label: 'Changelog' },
]

const SDKS = [
  { label: 'Node.js / TypeScript', href: 'https://www.npmjs.com/package/@scantelburydevs/notamei' },
  { label: 'Python',               href: 'https://pypi.org/project/notamei-gateway/' },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const linkCls = (href: string, exact?: boolean) =>
    [
      'block px-3 py-2.5 rounded-lg text-sm transition-colors',
      isActive(href, exact)
        ? 'bg-brand-cyan/10 text-brand-cyan font-medium'
        : 'text-text-2 hover:text-text-1 hover:bg-navy-700',
    ].join(' ')

  return (
    <div className="min-h-screen bg-white dark:bg-navy-900 text-slate-900 dark:text-text-1">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 dark:border-navy-600 bg-white/90 dark:bg-navy-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Left: logo + "Developer Portal" (lg+) */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <Link href="/" className="shrink-0">
              <LogoAdaptive
                lightSrc="/logos/gateway-logo-navbar-light.svg"
                darkSrc="/logos/gateway-logo-navbar-dark.svg"
                iconLightSrc="/logos/gateway-icon-only.svg"
                iconDarkSrc="/logos/gateway-icon-only.svg"
                alt="Nota MEI Gateway"
                width={160}
                height={38}
                priority
                className="w-[120px] sm:w-[140px] md:w-[160px] h-auto"
              />
            </Link>
            <span className="hidden lg:flex items-center gap-3 text-sm text-text-2 shrink-0">
              <span className="text-navy-600 select-none">|</span>
              Developer Portal
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Sandbox & Status — md+ only */}
            <Link
              href="/sandbox"
              className="hidden md:block text-sm text-text-2 hover:text-brand-cyan transition-colors whitespace-nowrap"
            >
              Sandbox
            </Link>
            <Link
              href="/status"
              className="hidden md:block text-sm text-text-2 hover:text-brand-cyan transition-colors"
            >
              Status
            </Link>

            {/* Criar conta — sm+ */}
            <Link
              href="/cadastro"
              className="hidden sm:inline-flex whitespace-nowrap text-sm px-3 py-1.5 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan transition-colors"
            >
              Criar conta
            </Link>

            <ThemeToggle />

            {/* Hambúrguer — md and below */}
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-slate-100 dark:hover:bg-navy-700 transition"
              aria-label="Abrir menu da documentação"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">

        {/* ── Mobile overlay ───────────────────────────────────────────── */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────────
            Mobile : fixed drawer that slides in from the left (z-40)
            Desktop: sticky column, always visible                        */}
        <aside
          className={[
            // shared
            'bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-600 overflow-y-auto',
            'transition-transform duration-200 ease-in-out',
            // mobile — fixed drawer
            'fixed inset-y-0 left-0 z-40 w-64',
            open ? 'translate-x-0' : '-translate-x-full',
            // desktop — sticky sidebar (overrides the mobile fixed/translate)
            'md:sticky md:top-14 md:h-[calc(100vh-3.5rem)]',
            'md:w-56 md:shrink-0 md:translate-x-0 md:z-auto',
            'md:inset-y-auto md:left-auto',
          ].join(' ')}
        >
          {/* Mobile-only header inside drawer */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-navy-600 md:hidden">
            <span className="text-sm font-semibold">Documentação</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-text-2 hover:text-text-1 hover:bg-slate-100 dark:hover:bg-navy-700 transition"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="p-4 md:py-8 md:px-0 md:pr-6 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={linkCls(item.href, item.exact)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* SDKs section */}
          <div className="px-4 md:px-0 md:pr-6 pb-8 pt-6 border-t border-slate-200 dark:border-navy-600 space-y-1">
            <p className="px-3 text-xs font-medium text-text-2 uppercase tracking-wider mb-2">
              SDKs
            </p>
            {SDKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-text-2 hover:text-text-1 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                {item.label} ↗
              </a>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main
          id="main-content"
          className="flex-1 min-w-0 py-8 px-4 sm:px-6 md:pl-8 md:pr-4 border-l border-slate-200 dark:border-navy-600"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
