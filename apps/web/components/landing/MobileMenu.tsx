'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import ThemeToggle from '@/components/ui/ThemeToggle'

export interface NavLink {
  label: string
  href: string
  isAnchor?: boolean // true = <a href> (âncora da página), false = <Link> (rota)
}

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  links: NavLink[]
  cta: { label: string; href: string }
}

export default function MobileMenu({ isOpen, onClose, links, cta }: MobileMenuProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Overlay fullscreen abaixo da navbar (top-14 = 56px = h-14 mobile) */}
      <div
        className="sm:hidden fixed inset-0 top-14 z-40 bg-white dark:bg-navy-900 flex flex-col overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-text-2 hover:text-text-1 hover:bg-slate-100 dark:hover:bg-navy-700 transition"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Links de navegação */}
        <nav className="flex flex-col px-6 pt-6 pb-4 gap-0">
          {links.map(({ label, href, isAnchor }) =>
            isAnchor ? (
              <a
                key={label}
                href={href}
                onClick={onClose}
                className="py-4 text-base font-semibold text-text-1 border-b border-slate-200 dark:border-navy-600 hover:text-brand-cyan transition"
              >
                {label}
              </a>
            ) : (
              <Link
                key={label}
                href={href}
                onClick={onClose}
                className="py-4 text-base font-semibold text-text-1 border-b border-slate-200 dark:border-navy-600 hover:text-brand-cyan transition"
              >
                {label}
              </Link>
            )
          )}
        </nav>

        {/* Rodapé do menu: ThemeToggle + CTA */}
        <div className="px-6 pt-4 pb-8 flex flex-col gap-4 mt-auto">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-2">Tema</span>
            <ThemeToggle />
          </div>
          <Link
            href={cta.href}
            onClick={onClose}
            className="w-full bg-brand-cyan text-navy-900 text-base font-semibold px-6 py-3 rounded-xl text-center hover:opacity-90 transition"
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </>
  )
}
