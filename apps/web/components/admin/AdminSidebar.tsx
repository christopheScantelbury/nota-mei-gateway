'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: string
  exact: boolean
}

const adminNav: NavItem[] = [
  { href: '/admin',            label: 'Visão Geral',     icon: '📊', exact: true  },
  { href: '/admin/usuarios',   label: 'Usuários',        icon: '👥', exact: false },
  { href: '/admin/notas',      label: 'Notas Fiscais',   icon: '🧾', exact: false },
  { href: '/admin/planos',     label: 'Planos',          icon: '💳', exact: false },
  { href: '/admin/landing',    label: 'Landing',         icon: '🌐', exact: false },
  { href: '/admin/permissoes', label: 'Permissões',      icon: '🔐', exact: false },
]

interface Props {
  /** true = super_admin (mostra tudo). false = filtra por allowedPaths. */
  isSuperAdmin: boolean
  /** Paths que o user tem READ. null = todos (super_admin). */
  allowedPaths: string[] | null
}

function isItemVisible(item: NavItem, isSuperAdmin: boolean, allowedPaths: string[] | null): boolean {
  if (isSuperAdmin) return true
  if (item.href === '/admin') return true  // dashboard root sempre visível pra qualquer admin ativo
  if (!allowedPaths) return false
  return allowedPaths.some((p) => item.href === p || item.href.startsWith(p + '/'))
}

export default function AdminSidebar({ isSuperAdmin, allowedPaths }: Props) {
  const pathname = usePathname()
  const visibleItems = adminNav.filter((item) => isItemVisible(item, isSuperAdmin, allowedPaths))

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
        <p className="text-xs text-text-2 mt-0.5">
          {isSuperAdmin ? 'Super admin' : 'Admin'}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1" aria-label="Menu admin">
        {visibleItems.map(({ href, label, icon, exact }) => {
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
