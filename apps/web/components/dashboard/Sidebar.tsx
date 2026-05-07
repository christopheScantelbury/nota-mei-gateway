'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { EmpresaSwitcher } from '@/components/dashboard/EmpresaSwitcher'

// ── Nav item definitions ────────────────────────────────────────────────────

type EmpresaTipo = 'MEI' | 'ME' | 'EPP'

type NavItem = {
  href: string
  label: string
  icon: string
  badge: string | null
  /** which empresa types see this item */
  tipos: EmpresaTipo[] | 'all'
}

const NAV_ITEMS: NavItem[] = [
  { href: '/notas',         label: 'Notas Fiscais',       icon: '🧾', badge: null,       tipos: 'all'                },
  { href: '/templates',     label: 'Templates',           icon: '📄', badge: 'PRO',      tipos: 'all'                },
  { href: '/recorrencias',  label: 'Automação',           icon: '🔄', badge: 'BUSINESS', tipos: ['ME', 'EPP']        },
  { href: '/api-keys',      label: 'API Keys',            icon: '🔑', badge: null,       tipos: 'all'                },
  { href: '/webhooks',      label: 'Webhooks',            icon: '🔗', badge: null,       tipos: ['ME', 'EPP']        },
  { href: '/billing',       label: 'Plano & Faturamento', icon: '💳', badge: null,       tipos: 'all'                },
  { href: '/configuracoes', label: 'Configurações',       icon: '⚙️', badge: null,       tipos: 'all'                },
]

function getVisibleItems(empresaTipo: EmpresaTipo): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.tipos === 'all' || item.tipos.includes(empresaTipo),
  )
}

const ADMIN_ITEM = { href: '/admin', label: 'Painel Admin', icon: '🛡️' }

// ── Logo by product ─────────────────────────────────────────────────────────

// Logo por persona — MEI usa variante teal, ME/EPP usa variante coral.
// Cada persona tem versão light + dark.
function SidebarLogo({
  tipoUsuario,
  empresaTipo,
  onClick,
}: {
  tipoUsuario?: 'mei' | 'gateway'
  empresaTipo?: EmpresaTipo
  onClick?: () => void
}) {
  const isMei = empresaTipo === 'MEI' || tipoUsuario === 'mei'
  const lightSrc = isMei ? '/brand/notafacil-mei.svg' : '/brand/notafacil-empresa.svg'
  const darkSrc  = isMei ? '/brand/notafacil-mei.svg' : '/brand/notafacil-empresa.svg'
  const alt      = isMei ? 'NotaFácil MEI' : 'NotaFácil Empresa'
  const width    = isMei ? 170 : 200

  return (
    <div className="px-5 py-5 border-b border-navy-600">
      <Link href="/home" className="block" onClick={onClick}>
        <Image
          src={lightSrc}
          alt={alt}
          width={width}
          height={32}
          className="block dark:hidden h-8 w-auto"
          priority
        />
        <Image
          src={darkSrc}
          alt={alt}
          width={width}
          height={32}
          className="hidden dark:block h-8 w-auto"
          priority
        />
      </Link>
    </div>
  )
}

// ── Nav content (shared between desktop sidebar and mobile drawer) ───────────

type SwitcherEmpresa = { id: string; tipo: string; razao_social: string }

function NavContent({
  razaoSocial,
  isAdmin,
  tipoUsuario,
  empresaTipo,
  empresaAtiva,
  todasEmpresas,
  onNavClick,
  notificationBell,
}: {
  razaoSocial: string
  isAdmin: boolean
  tipoUsuario?: 'mei' | 'gateway'
  empresaTipo?: EmpresaTipo
  empresaAtiva?: SwitcherEmpresa
  todasEmpresas?: SwitcherEmpresa[]
  onNavClick?: () => void
  notificationBell?: React.ReactNode
}) {
  const pathname = usePathname()

  // Resolve effective tipo: new prop takes precedence over legacy prop
  const effectiveTipo: EmpresaTipo = empresaTipo
    ?? (tipoUsuario === 'mei' ? 'MEI' : 'ME')

  const visibleItems = getVisibleItems(effectiveTipo)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <SidebarLogo tipoUsuario={tipoUsuario} empresaTipo={empresaTipo} onClick={onNavClick} />

      {/* Empresa: switcher se múltiplas, texto estático se única */}
      <div className="px-5 pt-3 pb-1">
        {empresaAtiva && todasEmpresas && todasEmpresas.length > 1 ? (
          <EmpresaSwitcher empresaAtiva={empresaAtiva} todasEmpresas={todasEmpresas} />
        ) : (
          <p className="text-xs text-text-2 truncate">{razaoSocial}</p>
        )}
      </div>

      {/* Nav principal */}
      <nav className="flex-1 py-3 px-3 space-y-1" aria-label="Menu principal">
        {visibleItems.map(({ href, label, icon, badge }) => {
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

        {/* Link admin — visível apenas para admins */}
        {isAdmin && (
          <div className="pt-2 mt-2 border-t border-navy-600">
            <Link
              href={ADMIN_ITEM.href}
              onClick={onNavClick}
              className={[
                'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                pathname.startsWith(ADMIN_ITEM.href)
                  ? 'bg-nota-upgrade/10 text-nota-upgrade'
                  : 'text-nota-upgrade/70 hover:text-nota-upgrade hover:bg-nota-upgrade/10',
              ].join(' ')}
            >
              <span className="shrink-0" aria-hidden="true">{ADMIN_ITEM.icon}</span>
              <span className="flex-1">{ADMIN_ITEM.label}</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-navy-600 flex items-center justify-between gap-2">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs text-text-2 hover:text-nota-rejeitada transition-colors min-h-[44px] flex items-center"
          >
            Sair
          </button>
        </form>
        <div className="flex items-center gap-1">
          {notificationBell}
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

// ── Sidebar component ────────────────────────────────────────────────────────

export default function Sidebar({
  razaoSocial,
  isAdmin = false,
  tipoUsuario = 'gateway',
  empresaTipo,
  empresaAtiva,
  todasEmpresas,
  notificationBell,
}: {
  razaoSocial: string
  isAdmin?: boolean
  tipoUsuario?: 'mei' | 'gateway'
  empresaTipo?: EmpresaTipo
  empresaAtiva?: SwitcherEmpresa
  todasEmpresas?: SwitcherEmpresa[]
  notificationBell?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const navProps = { razaoSocial, isAdmin, tipoUsuario, empresaTipo, empresaAtiva, todasEmpresas, notificationBell }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-navy-700 min-h-screen flex-col border-r border-navy-600">
        <NavContent {...navProps} />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-14 px-4 bg-navy-700 border-b border-navy-600">
        <Link href="/home" className="flex items-center">
          {(() => {
            const isMei = empresaTipo === 'MEI' || tipoUsuario === 'mei'
            const src   = isMei ? '/brand/notafacil-mei.svg' : '/brand/notafacil-empresa.svg'
            const alt   = isMei ? 'NotaFácil MEI' : 'NotaFácil Empresa'
            const width = isMei ? 145 : 175
            return (
              <Image src={src} alt={alt} width={width} height={28} className="h-7 w-auto" priority />
            )
          })()}
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
            <NavContent
              {...navProps}
              onNavClick={() => setOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  )
}
