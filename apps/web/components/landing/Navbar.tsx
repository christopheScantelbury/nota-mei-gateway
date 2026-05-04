'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ui/ThemeToggle'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-navy-600 bg-navy-900/90 backdrop-blur-md shadow-lg'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        {/* Logo — alterna entre versão clara (light mode) e escura (dark mode) */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logos/gateway-logo-navbar-light.svg"
            alt="Nota MEI Gateway"
            width={200}
            height={43}
            priority
            unoptimized
            className="block dark:hidden"
          />
          <Image
            src="/logos/gateway-logo-navbar-dark.svg"
            alt="Nota MEI Gateway"
            width={200}
            height={43}
            priority
            unoptimized
            className="hidden dark:block"
          />
        </Link>

        <div className="flex gap-4 items-center">
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
      </div>
    </nav>
  )
}
