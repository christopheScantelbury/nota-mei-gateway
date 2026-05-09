'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import MobileMenu from '@/components/landing/MobileMenu'

// ── Persona por pathname ─────────────────────────────────────────────────────
// Cada página de produto tem sua variante de logo + cor de CTA. Páginas neutras
// (home, /precos, /docs, /status, /cadastro, /login) usam a logo principal.
type Persona = {
  logoSrc: string
  alt: string
  width: number
  ctaClass: string
}

const PERSONA_DEFAULT: Persona = {
  logoSrc: '/brand/notafacil-logo.svg',
  alt: 'NotaFácil',
  width: 170,
  ctaClass: 'bg-brand-blue text-white shadow-sm hover:bg-brand-blue-dark',
}

function getPersonaForPath(pathname: string): Persona {
  if (pathname.startsWith('/mei')) {
    return { logoSrc: '/brand/notafacil-mei.svg', alt: 'NotaFácil MEI', width: 200,
             ctaClass: 'bg-persona-mei text-white shadow-sm hover:bg-persona-mei-dark' }
  }
  if (pathname.startsWith('/me')) {
    return { logoSrc: '/brand/notafacil-empresa.svg', alt: 'NotaFácil Empresa', width: 240,
             ctaClass: 'bg-persona-emp text-white shadow-sm hover:bg-persona-emp-dark' }
  }
  if (pathname.startsWith('/gateway')) {
    return { logoSrc: '/brand/notafacil-api.svg', alt: 'NotaFácil API', width: 195,
             ctaClass: 'bg-persona-api text-white shadow-sm hover:bg-persona-api-dark' }
  }
  return PERSONA_DEFAULT
}

const mobileLinks = [
  { label: 'MEI',           href: '/mei',     isAnchor: false },
  { label: 'ME / EPP',      href: '/me',      isAnchor: false },
  { label: 'Gateway API',   href: '/gateway', isAnchor: false },
  { label: 'Preços',        href: '/precos',  isAnchor: false },
  { label: 'Blog',          href: '/blog',    isAnchor: false },
  { label: 'Documentação',  href: '/docs',    isAnchor: false },
  { label: 'Status',        href: '/status',  isAnchor: false },
]

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const pathname = usePathname() ?? '/'
  const persona = getPersonaForPath(pathname)

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
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
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
              darkSrc={persona.logoSrc}
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
            <Link href="/mei"     className="text-sm text-text-2 hover:text-text-1 transition-colors">MEI</Link>
            <Link href="/me"      className="text-sm text-text-2 hover:text-text-1 transition-colors">ME / EPP</Link>
            <Link href="/gateway" className="text-sm text-text-2 hover:text-text-1 transition-colors">Gateway API</Link>
            <Link href="/precos"  className="text-sm text-text-2 hover:text-text-1 transition-colors">Preços</Link>
            <Link href="/blog"    className="text-sm text-text-2 hover:text-text-1 transition-colors">Blog</Link>
          </div>

          {/* CTAs — desktop only (sm+) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-medium text-text-2 hover:text-text-1 transition-colors px-3 py-2 rounded-lg hover:bg-navy-700/50 dark:hover:bg-navy-700"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={`text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${persona.ctaClass}`}
            >
              Cadastrar grátis
            </Link>
          </div>

          {/* Mobile: ThemeToggle + hambúrguer */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-slate-100 dark:hover:bg-navy-700 transition"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Overlay mobile */}
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={mobileLinks}
        cta={{ label: 'Cadastrar grátis', href: '/cadastro' }}
        secondaryCta={{ label: 'Entrar', href: '/login' }}
      />
    </>
  )
}
