'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import MobileMenu from '@/components/landing/MobileMenu'

const mobileLinks = [
  { label: 'Como funciona', href: '#como-funciona', isAnchor: true },
  { label: 'Preços',        href: '#precos',        isAnchor: true },
  { label: 'Documentação',  href: '/docs',          isAnchor: false },
  { label: 'Status da API', href: '/status',        isAnchor: false },
]

export default function NavbarGateway() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

          <Link href="/gateway" className="flex items-center shrink-0" aria-label="NotaFácil API">
            <LogoAdaptive
              lightSrc="/brand/notafacil-api.svg"
              darkSrc="/brand/notafacil-api.svg"
              iconLightSrc="/brand/notafacil-icon.svg"
              iconDarkSrc="/brand/notafacil-icon.svg"
              alt="NotaFácil API"
              width={195}
              height={43}
              priority
              className="w-auto h-9 sm:h-10"
            />
          </Link>

          {/* Desktop */}
          <div className="hidden sm:flex items-center gap-4">
            <a href="#como-funciona" className="text-sm text-text-2 hover:text-text-1 transition">Como funciona</a>
            <a href="#precos"        className="text-sm text-text-2 hover:text-text-1 transition">Preços</a>
            <a href="/docs"          className="text-sm text-text-2 hover:text-text-1 transition">Docs</a>
            <ThemeToggle />
            <Link
              href="/cadastro?produto=gateway"
              className="bg-persona-api text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm hover:bg-persona-api-dark transition-colors"
            >
              Criar conta de teste
            </Link>
          </div>

          {/* Mobile */}
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

      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={mobileLinks}
        cta={{ label: 'Criar conta de teste', href: '/cadastro?produto=gateway' }}
      />
    </>
  )
}
