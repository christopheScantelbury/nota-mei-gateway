'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminNav = [
  { href: '/admin',          label: 'Visão Geral',  icon: '📊', exact: true },
  { href: '/admin/usuarios', label: 'Usuários',     icon: '👥', exact: false },
  { href: '/admin/notas',    label: 'Notas Fiscais', icon: '🧾', exact: false },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex w-56 shrink-0 bg-navy-700 min-h-screen flex-col border-r border-navy-600">
      {/* Header */}
      <div className="px-5 py-5 border-b border-navy-600">
        <Link href="/home" className="flex items-center gap-2 mb-1">
          <span className="text-xs text-text-2 hover:text-text-1 transition">← Voltar ao painel</span>
        </Link>
        <p className="font-display font-extrabold text-lg text-nota-upgrade tracking-tight">
          🛡️ Admin
        </p>
        <p className="text-xs text-text-2 mt-0.5">Nota Fácil MEI</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1" aria-label="Menu admin">
        {adminNav.map(({ href, label, icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-nota-upgrade/10 text-nota-upgrade'
                  : 'text-text-2 hover:text-text-1 hover:bg-navy-600',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="shrink-0" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
