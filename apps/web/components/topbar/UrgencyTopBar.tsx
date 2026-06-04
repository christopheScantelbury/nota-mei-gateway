'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isTopbarDismissed, dismissTopbar } from '@/lib/cookies/topbar'
import { VIGENCIA_DATE } from '@/lib/dates/countdown'
import { trackTopbarView, trackTopbarDismiss, trackCtaClick } from '@/lib/analytics/events'

/**
 * Barra fixa de urgência regulatória (acima do Navbar).
 *
 * Spec: HIST-1.1.
 *
 * Posicionamento:
 * - `fixed top-0 inset-x-0 z-[60]` (acima do Navbar fixed z-50)
 * - **Altura conhecida h-8 (mobile 32px) / sm:h-9 (desktop 36px)** — também
 *   declarada em `globals.css` como `--topbar-height` para o Navbar usar como
 *   offset (`top: var(--topbar-height)`). Isso evita race condition de SSR.
 * - Ao dismiss, sobrescreve `--topbar-height: 0px` no documentElement → Navbar
 *   volta a `top: 0px`.
 */
interface UrgencyTopBarProps {
  /** Lido do cookie no servidor (Server Component pai). Elimina o flash
   *  laranja no primeiro paint pra quem já dismissou antes. */
  initialDismissed?: boolean
}

export default function UrgencyTopBar({ initialDismissed = false }: UrgencyTopBarProps) {
  // SSR já sabe se está dismissed (via cookie lido no servidor) — sem flash.
  const [visible, setVisible] = useState(!initialDismissed)
  const [isPostVigencia, setIsPostVigencia] = useState(false)

  useEffect(() => {
    setIsPostVigencia(new Date() >= VIGENCIA_DATE)
    // Reconfirma do cookie do browser (cobre caso de cookie expirar entre SSR
    // e hydration, ou dismiss em outra aba). Mantém em sincronia.
    const dismissed = isTopbarDismissed()
    if (dismissed !== initialDismissed) {
      setVisible(!dismissed)
    }
    if (dismissed) {
      document.documentElement.style.setProperty('--topbar-height', '0px')
    } else {
      trackTopbarView()
    }
  }, [initialDismissed])

  function handleDismiss() {
    dismissTopbar()
    setVisible(false)
    // Zera o offset → Navbar sobe pra top-0
    document.documentElement.style.setProperty('--topbar-height', '0px')
    trackTopbarDismiss()
  }
  function handleCtaClick() {
    trackCtaClick({ persona: 'unknown', location: 'topbar' })
  }

  if (!visible) return null

  const message = isPostVigencia
    ? 'NFS-e Nacional vigente desde 01/09/2026 — emita a sua agora'
    : 'NFS-e Nacional obrigatória em Set/2026 — Migre antes da multidão'

  return (
    <div
      role="region"
      aria-label="Aviso de urgência regulatória"
      className="fixed top-0 inset-x-0 z-[60] h-8 sm:h-9 w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm flex items-center"
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-center gap-2 sm:gap-3 text-center px-10 sm:px-4 text-xs sm:text-sm leading-tight">
        <span aria-hidden className="hidden sm:inline">⏰</span>
        <span className="truncate sm:whitespace-normal">{message}</span>
        <Link
          href="/comparativo"
          onClick={handleCtaClick}
          className="underline font-semibold hover:no-underline whitespace-nowrap shrink-0"
        >
          Saiba mais
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Fechar aviso"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white text-lg leading-none"
      >
        ✕
      </button>
    </div>
  )
}
