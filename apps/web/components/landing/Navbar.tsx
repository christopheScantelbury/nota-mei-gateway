'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import MobileMenu from '@/components/landing/MobileMenu'

const mobileLinks = [
  { label: 'Planos',        href: '#planos',       isAnchor: true },
  { label: 'FAQ',           href: '#faq',           isAnchor: true },
  { label: 'Documentação',  href: '/docs',          isAnchor: false },
  { label: 'Status da API', href: '/status',        isAnchor: false },
]

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Fechar menu ao pressionar Escape
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

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
              className="w-[120px] sm:w-[150px] md:w-[160px] h-auto"
            />
          </Link>

          {/* Links — desktop only */}
          <div className="hidden sm:flex items-center gap-4">
            <a href="#planos" className="text-sm text-text-2 hover:text-text-1 transition">Planos</a>
            <a href="#faq"    className="text-sm text-text-2 hover:text-text-1 transition">FAQ</a>
            <a href="/docs"   className="text-sm text-text-2 hover:text-text-1 transition">Docs</a>
            <ThemeToggle />
            <Link
              href="/cadastro"
              className="bg-brand-cyan text-navy-900 text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Começar grátis
            </Link>
          </div>

          {/* Mobile: ThemeToggle compacto + hambúrguer */}
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
        cta={{ label: 'Começar grátis', href: '/cadastro' }}
      />
    </>
  )
}
