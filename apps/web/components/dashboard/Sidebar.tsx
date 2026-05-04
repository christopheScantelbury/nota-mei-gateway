'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/notas',         label: 'Notas Fiscais',   icon: '🧾', badge: null         },
  { href: '/templates',     label: 'Templates',       icon: '📄', badge: 'PRO'        },
  { href: '/recorrencias',  label: 'Automação',       icon: '🔄', badge: 'BUSINESS'   },
  { href: '/billing',       label: 'Plano & Billing', icon: '💳', badge: null         },
  { href: '/configuracoes', label: 'Configurações',   icon: '⚙️', badge: null        },
]

export default function Sidebar({ razaoSocial }: { razaoSocial: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-navy-700 min-h-screen flex flex-col border-r border-navy-600">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-navy-600">
        <Link href="/home" className="block">
          <span className="font-display font-extrabold text-xl text-brand-cyan tracking-tight">
            Nota MEI
          </span>
        </Link>
        <p className="text-xs text-text-2 mt-0.5 truncate">{razaoSocial}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : 'text-text-2 hover:text-text-1 hover:bg-navy-600',
              ].join(' ')}
            >
              <span className="shrink-0">{icon}</span>
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
      <div className="px-6 py-4 border-t border-navy-600">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs text-text-2 hover:text-nota-rejeitada transition-colors"
          >
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
