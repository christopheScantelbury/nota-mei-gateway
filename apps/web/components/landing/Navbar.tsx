'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import MobileMenu from '@/components/landing/MobileMenu'

const mobileLinks = [
  { label: 'MEI',           href: '/mei',     isAnchor: false },
  { label: 'ME / EPP',      href: '/me',      isAnchor: false },
  { label: 'Gateway API',   href: '/gateway', isAnchor: false },
  { label: 'Preços',        href: '/precos',  isAnchor: false },
  { label: 'Documentação',  href: '/docs',    isAnchor: false },
  { label: 'Status',        href: '/status',  isAnchor: false },
]

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

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

          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0">
            <LogoAdaptive
              lightSrc="/logos/nfm-logo-navbar-light.svg"
              darkSrc="/logos/nfm-logo-navbar-dark-clean.svg"
              iconLightSrc="/logos/nfm-icon-only.svg"
              iconDarkSrc="/logos/nfm-icon-only.svg"
              alt="Nota Fácil MEI"
              width={160}
              height={44}
              priority
              className="w-[120px] sm:w-[140px] md:w-[155px] h-auto"
            />
          </Link>

          {/* Produto links — centro, desktop only (lg+) */}
          <div className="hidden lg:flex items-center gap-6 flex-1 justify-center">
            <Link href="/mei"     className="text-sm text-text-2 hover:text-text-1 transition-colors">MEI</Link>
            <Link href="/me"      className="text-sm text-text-2 hover:text-text-1 transition-colors">ME / EPP</Link>
            <Link href="/gateway" className="text-sm text-text-2 hover:text-text-1 transition-colors">Gateway API</Link>
            <Link href="/precos"  className="text-sm text-text-2 hover:text-text-1 transition-colors">Preços</Link>
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
              className="bg-brand-cyan text-navy-900 text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
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
