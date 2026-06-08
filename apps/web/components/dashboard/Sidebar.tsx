'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { EmpresaSwitcher } from '@/components/dashboard/EmpresaSwitcher'
import { Button } from '@/components/ui/Button'
import { features, type PlanTier } from '@/lib/plan-tier'

// ── Nav item definitions ────────────────────────────────────────────────────

type EmpresaTipo = 'MEI' | 'ME' | 'EPP'

type NavItem = {
  href: string
  label: string
  icon: string
  badge: string | null
  /** Empresa types que veem o item. */
  tipos: EmpresaTipo[] | 'all'
  /** Plan tier mínimo. Default: 'trial' (qualquer). */
  minTier?: PlanTier
}

// Labels em PT-BR claro pra usuário não-técnico. "Configurações" virou
// "Minha empresa" (pediu o user 2026-06-05 — mais fácil de entender).
const NAV_ITEMS: NavItem[] = [
  { href: '/notas',         label: 'Notas Fiscais',         icon: '🧾', badge: null,       tipos: 'all' },
  { href: '/clientes',      label: 'Clientes',              icon: '👥', badge: 'Starter',  tipos: 'all',         minTier: 'starter' },
  { href: '/templates',     label: 'Modelos de Nota',       icon: '📄', badge: 'Starter',  tipos: 'all',         minTier: 'starter' },
  { href: '/recorrencias',  label: 'Notas Recorrentes',     icon: '🔄', badge: 'Starter',  tipos: 'all',         minTier: 'starter' },
  { href: '/links',         label: 'Links de Cobrança',     icon: '🔗', badge: 'Starter',  tipos: 'all',         minTier: 'starter' },
  { href: '/api-keys',      label: 'Chaves de API',         icon: '🔑', badge: 'Pro',      tipos: ['ME', 'EPP'], minTier: 'pro' },
  { href: '/webhooks',      label: 'Notificações automáticas', icon: '🔔', badge: 'Pro',   tipos: ['ME', 'EPP'], minTier: 'pro' },
  { href: '/billing',       label: 'Plano e Pagamento',     icon: '💳', badge: null,       tipos: 'all' },
  { href: '/configuracoes', label: 'Minha empresa',         icon: '⚙️', badge: null,       tipos: 'all' },
]

function getVisibleItems(empresaTipo: EmpresaTipo): NavItem[] {
  // Decisão de UX 2026-06-05: trial vê TODOS os itens (não esconde
  // features premium). Itens que o tier do user não acessa ficam
  // visualmente "locked" (cinza + cadeado) com tooltip e click leva
  // pra /billing?upgrade=label — estratégia de gancho de upgrade.
  return NAV_ITEMS.filter((item) => item.tipos === 'all' || item.tipos.includes(empresaTipo))
}

/**
 * Retorna true se o item da nav é acessível no tier atual. Itens sem
 * `minTier` (nav básica) sempre acessíveis.
 */
function itemAccessible(item: NavItem, planTier: PlanTier): boolean {
  if (!item.minTier) return true
  if (item.minTier === 'pro') return features.canUseAPI(planTier)
  if (item.minTier === 'starter') return features.canUseClientes(planTier)
  return true
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
  planTier = 'trial',
  empresaAtiva,
  todasEmpresas,
  onNavClick,
  notificationBell,
}: {
  razaoSocial: string
  isAdmin: boolean
  tipoUsuario?: 'mei' | 'gateway'
  empresaTipo?: EmpresaTipo
  planTier?: PlanTier
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
        {visibleItems.map((item) => {
          const { href, label, icon, badge } = item
          const accessible = itemAccessible(item, planTier)
          // Bloqueado: aponta pro billing com o feature alvo no query — ajuda
          // a página de upgrade a contextualizar o CTA.
          const finalHref = accessible ? href : `/billing?upgrade=${encodeURIComponent(label)}`
          const active = pathname.startsWith(href) && accessible
          return (
            <Link
              key={href}
              href={finalHref}
              onClick={onNavClick}
              title={accessible ? undefined : `Disponível no plano ${badge ?? 'pago'} — faça upgrade pra usar.`}
              className={[
                'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-cyan/10 text-brand-cyan'
                  : accessible
                    ? 'text-text-2 hover:text-text-1 hover:bg-navy-600'
                    : 'text-text-2/60 hover:text-text-2 hover:bg-navy-600/50',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
              aria-disabled={!accessible}
            >
              <span className="shrink-0 relative" aria-hidden="true">
                <span className={accessible ? '' : 'opacity-60'}>{icon}</span>
                {!accessible && (
                  <span className="absolute -bottom-1 -right-1 text-[10px] leading-none">🔒</span>
                )}
              </span>
              <span className="flex-1">{label}</span>
              {/* Badge "Starter/Pro" só aparece se o tier do user NÃO cobre a
                  feature — funciona como gancho de upgrade. Quem já tem
                  acesso não precisa de etiqueta (vira ruído visual). */}
              {badge && !accessible && (
                <span
                  className="text-[10px] font-bold tracking-wide rounded-full px-1.5 py-px leading-none border text-nota-upgrade/80 border-nota-upgrade/30 bg-nota-upgrade/5"
                >
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
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-xs hover:text-nota-rejeitada"
          >
            Sair
          </Button>
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
  planTier = 'trial',
  empresaAtiva,
  todasEmpresas,
  notificationBell,
}: {
  razaoSocial: string
  isAdmin?: boolean
  tipoUsuario?: 'mei' | 'gateway'
  empresaTipo?: EmpresaTipo
  /** Tier do plano ativo. Trial esconde API Keys/Webhooks/Templates/etc. */
  planTier?: PlanTier
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

  const navProps = { razaoSocial, isAdmin, tipoUsuario, empresaTipo, planTier, empresaAtiva, todasEmpresas, notificationBell }

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="hover:bg-navy-600"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <rect y="3"  width="20" height="2" rx="1" />
            <rect y="9"  width="20" height="2" rx="1" />
            <rect y="15" width="20" height="2" rx="1" />
          </svg>
        </Button>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="hover:bg-navy-600"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                  <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </Button>
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
