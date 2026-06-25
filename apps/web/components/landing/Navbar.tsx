'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import MobileMenu from '@/components/landing/MobileMenu'
import { Button } from '@/components/ui/Button'

// ── Persona por pathname ─────────────────────────────────────────────────────
// Cada página de produto tem sua variante de logo + cor de CTA. Páginas neutras
// (home, /precos, /docs, /status, /cadastro, /login) usam a logo principal.
type Persona = {
  logoSrc: string
  logoDarkSrc: string
  alt: string
  width: number
  ctaClass: string
}

// Logos adaptam ao tema: light → SVG com texto "Nota" preto, dark → SVG com
// texto "Nota" branco. Versões dark geradas via script (fill #0F172A → #F8FAFC).
const PERSONA_DEFAULT: Persona = {
  logoSrc:     '/brand/notafacil-logo.svg',
  logoDarkSrc: '/brand/notafacil-logo-dark.svg',
  alt: 'NotaFácil',
  width: 170,
  ctaClass: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue-dark',
}

function getPersonaForPath(pathname: string): Persona {
  if (pathname.startsWith('/mei')) {
    return {
      logoSrc: '/brand/notafacil-mei.svg', logoDarkSrc: '/brand/notafacil-mei-dark.svg',
      alt: 'NotaFácil MEI', width: 200,
      ctaClass: 'bg-persona-mei text-white shadow-sm hover:bg-persona-mei-dark',
    }
  }
  if (pathname.startsWith('/me')) {
    return {
      logoSrc: '/brand/notafacil-empresa.svg', logoDarkSrc: '/brand/notafacil-empresa-dark.svg',
      alt: 'NotaFácil Empresa', width: 240,
      ctaClass: 'bg-persona-emp text-white shadow-sm hover:bg-persona-emp-dark',
    }
  }
  if (pathname.startsWith('/gateway')) {
    return {
      logoSrc: '/brand/notafacil-api.svg', logoDarkSrc: '/brand/notafacil-api-dark.svg',
      alt: 'NotaFácil API', width: 195,
      ctaClass: 'bg-persona-api text-white shadow-sm hover:bg-persona-api-dark',
    }
  }
  return PERSONA_DEFAULT
}

// Deriva os hrefs de login e cadastro pelo pathname.
// Páginas de produto direcionam direto para o login/cadastro da persona.
// Páginas neutras (home, /precos…) enviam para /login sem ?produto, onde
// o usuário escolhe a persona antes de ver o formulário.
function getHrefsForPath(pathname: string) {
  if (pathname.startsWith('/mei'))     return { loginHref: '/login?produto=mei',     cadastroHref: '/cadastro?produto=mei' }
  if (pathname.startsWith('/me'))      return { loginHref: '/login?produto=me',      cadastroHref: '/cadastro/me' }
  if (pathname.startsWith('/gateway')) return { loginHref: '/login?produto=gateway', cadastroHref: '/cadastro/dev' }
  return { loginHref: '/login', cadastroHref: '/cadastro' }
}

// Quando o user está numa landing focada em persona, o link "Preços" da
// nav rola até a âncora #precos da própria página (evita um redirect pra
// /precos que mostra outra tabela). Em páginas neutras (home, docs, blog)
// o link vai pra /precos completa.
function getPricingHrefForPath(pathname: string) {
  if (pathname.startsWith('/mei'))     return '/mei#precos'
  if (pathname.startsWith('/me'))      return '/me#precos'
  if (pathname.startsWith('/gateway')) return '/gateway#precos'
  return '/precos'
}

function getMobileLinks(pathname: string) {
  return [
    // Foco do produto: ME/EPP + Gateway primeiro (MEI rebaixado pra terceiro).
    { label: 'ME / EPP',      href: '/me',      isAnchor: false },
    { label: 'Gateway API',   href: '/gateway', isAnchor: false },
    { label: 'MEI',           href: '/mei',     isAnchor: false },
    { label: 'Sandbox',       href: '/sandbox', isAnchor: false },
    { label: 'Preços',        href: getPricingHrefForPath(pathname), isAnchor: false },
    { label: 'Blog',          href: '/blog',    isAnchor: false },
    { label: 'Documentação',  href: '/docs',    isAnchor: false },
    { label: 'Status',        href: '/status',  isAnchor: false },
  ]
}

// Dropdown "Gateway API" com submenu (Overview, Docs, Sandbox, SDKs, Status).
// Spec: HIST-3.2 + D-08 (mantém hierarquia, sandbox dentro do produto Gateway).
function GatewayMenu() {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(v => !v)}
        className="text-sm text-text-2 hover:text-text-1 transition-colors inline-flex items-center gap-1"
      >
        Gateway API
        <span aria-hidden className="text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-[#1e2a47] shadow-xl py-2 z-30"
        >
          <Link role="menuitem" href="/gateway"  className="block px-4 py-2 text-sm text-text-1 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">Visão geral</Link>
          <Link role="menuitem" href="/sandbox"  className="block px-4 py-2 text-sm text-text-1 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
            ⚡ Sandbox <span className="text-[10px] text-brand-cyan ml-1">sem cadastro</span>
          </Link>
          <Link role="menuitem" href="/docs"     className="block px-4 py-2 text-sm text-text-1 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">Documentação</Link>
          <Link role="menuitem" href="/docs/sdks" className="block px-4 py-2 text-sm text-text-1 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">SDKs</Link>
          <Link role="menuitem" href="/status"   className="block px-4 py-2 text-sm text-text-1 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">Status</Link>
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const pathname = usePathname() ?? '/'
  const persona = getPersonaForPath(pathname)
  const { loginHref, cadastroHref } = getHrefsForPath(pathname)
  const pricingHref = getPricingHrefForPath(pathname)
  const mobileLinks = getMobileLinks(pathname)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <>
      {/* `top` consome --topbar-height (default 36px desktop / 32px mobile em globals.css).
          Topbar dismissed → variable vira 0px → nav sobe pra top-0. SSR-safe. */}
      <nav
        style={{ top: 'var(--topbar-height, 0px)' }}
        className={`fixed inset-x-0 z-50 transition-all duration-300 ${
          scrolled || menuOpen
            ? 'border-b border-navy-600/30 dark:border-navy-600 bg-white/95 dark:bg-navy-900/95 backdrop-blur-md shadow-sm'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        {/* h-14 mobile (56px) · h-16 desktop (64px) */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">

          {/* Logo — adapta-se ao contexto da página (MEI / Empresa / API / principal) */}
          <Link href="/" className="flex items-center shrink-0" aria-label={`${persona.alt} — página inicial`}>
            <LogoAdaptive
              lightSrc={persona.logoSrc}
              darkSrc={persona.logoDarkSrc}
              iconLightSrc="/brand/notafacil-icon.svg"
              iconDarkSrc="/brand/notafacil-icon.svg"
              alt={persona.alt}
              width={persona.width}
              height={42}
              priority
              className="w-auto h-9 sm:h-10"
            />
          </Link>

          {/* Produto links — centro, desktop only (lg+) */}
          <div className="hidden lg:flex items-center gap-6 flex-1 justify-center">
            <Link href="/me"      className="text-sm text-text-2 hover:text-text-1 transition-colors">ME / EPP</Link>
            <Link href="/mei"     className="text-sm text-text-2 hover:text-text-1 transition-colors">MEI</Link>
            <GatewayMenu />
            <Link href={pricingHref} className="text-sm text-text-2 hover:text-text-1 transition-colors">Preços</Link>
            <Link href="/blog"    className="text-sm text-text-2 hover:text-text-1 transition-colors">Blog</Link>
          </div>

          {/* CTAs — desktop only (sm+) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href={loginHref}
              className="text-sm font-medium text-text-2 hover:text-text-1 transition-colors px-3 py-2 rounded-lg hover:bg-navy-700/50 dark:hover:bg-navy-700"
            >
              Entrar
            </Link>
            <Link
              href={cadastroHref}
              className={`text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${persona.ctaClass}`}
            >
              Cadastrar grátis
            </Link>
          </div>

          {/* Mobile: ThemeToggle + hambúrguer */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              className="hover:bg-slate-100 dark:hover:bg-navy-700"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Overlay mobile */}
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={mobileLinks}
        cta={{ label: 'Cadastrar grátis', href: cadastroHref }}
        secondaryCta={{ label: 'Entrar', href: loginHref }}
      />
    </>
  )
}
