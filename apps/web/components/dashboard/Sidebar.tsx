'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'

const navItems = [
  { href: '/notas',         label: 'Notas Fiscais',   icon: '🧾', badge: null         },
  { href: '/templates',     label: 'Templates',       icon: '📄', badge: 'PRO'        },
  { href: '/recorrencias',  label: 'Automação',       icon: '🔄', badge: 'BUSINESS'   },
  { href: '/api-keys',      label: 'API Keys',        icon: '🔑', badge: null         },
  { href: '/billing',       label: 'Plano & Billing', icon: '💳', badge: null         },
  { href: '/configuracoes', label: 'Configurações',   icon: '⚙️', badge: null        },
]

function NavContent({
  razaoSocial,
  onNavClick,
}: {
  razaoSocial: string
  onNavClick?: () => void
}) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-navy-600">
        <Link href="/home" className="block" onClick={onNavClick}>
          <span className="font-display font-extrabold text-xl text-brand-cyan tracking-tight">
            Nota MEI
          </span>
        </Link>
        <p className="text-xs text-text-2 mt-0.5 truncate">{razaoSocial}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1" aria-label="Menu principal">
        {navItems.map(({ href, label, icon, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={[
                'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-text-2 hover:text-text-1 hover:bg-navy-600',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="shrink-0" aria-hidden="true">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] font-bold tracking-wide text-nota-upgrade border border-nota-upgrade/40 rounded-full px-1.5 py-px leading-none">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-navy-600 flex items-center justify-between">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs text-text-2 hover:text-nota-rejeitada transition-colors min-h-[44px] flex items-center"
          >
            Sair
          </button>
        </form>
        <ThemeToggle />
      </div>
    </div>
  )
}

export default function Sidebar({ razaoSocial }: { razaoSocial: string }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Trap scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-navy-700 min-h-screen flex-col border-r border-navy-600">
        <NavContent razaoSocial={razaoSocial} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-navy-700 border-b border-navy-600">
        <Link href="/home" className="font-display font-extrabold text-lg text-brand-cyan tracking-tight">
          Nota MEI
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-2 hover:text-text-1 hover:bg-navy-600 transition"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <rect y="3"  width="20" height="2" rx="1" />
            <rect y="9"  width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-navy-900/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <aside
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-navy-700 border-r border-navy-600 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navegação"
          >
            <div className="flex items-center justify-end px-4 py-3 border-b border-navy-600">
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-2 hover:text-text-1 hover:bg-navy-600 transition"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                  <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavContent razaoSocial={razaoSocial} onNavClick={() => setOpen(false)} />
          </aside>
        </>
      )}

    </>
  )
}
