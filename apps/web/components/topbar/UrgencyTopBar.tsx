'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { isTopbarDismissed, dismissTopbar } from '@/lib/cookies/topbar'
import { VIGENCIA_DATE } from '@/lib/dates/countdown'
import { trackTopbarView, trackTopbarDismiss, trackCtaClick } from '@/lib/analytics/events'

/**
 * Barra fixa no topo com mensagem de urgência regulatória.
 *
 * Spec: HIST-1.1.
 *
 * Posicionamento:
 * - `fixed top-0 inset-x-0 z-[60]` (acima do Navbar fixed z-50)
 * - Seta `--topbar-height` no documentElement com a altura real (ResizeObserver),
 *   permitindo que o Navbar adapte seu `top` via CSS variable
 * - Cleanup zera a variável quando desmonta/dismiss → Navbar volta pra top-0
 */
export default function UrgencyTopBar() {
  const [visible, setVisible] = useState(false)
  const [isPostVigencia, setIsPostVigencia] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dismissed = isTopbarDismissed()
    setIsPostVigencia(new Date() >= VIGENCIA_DATE)
    setVisible(!dismissed)
    if (!dismissed) trackTopbarView()
  }, [])

  // Mede a altura real e propaga via CSS variable pra Navbar consumir.
  useEffect(() => {
    if (!visible) {
      document.documentElement.style.setProperty('--topbar-height', '0px')
      return
    }
    const el = ref.current
    if (!el) return
    const apply = () => {
      const h = el.offsetHeight
      document.documentElement.style.setProperty('--topbar-height', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.setProperty('--topbar-height', '0px')
    }
  }, [visible])

  function handleDismiss() {
    dismissTopbar()
    setVisible(false)
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
      ref={ref}
      role="region"
      aria-label="Aviso de urgência regulatória"
      className="fixed top-0 inset-x-0 z-[60] w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs sm:text-sm py-1.5 px-10 sm:px-4 shadow-md"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 sm:gap-3 text-center">
        <span aria-hidden className="hidden sm:inline">⏰</span>
        <span className="leading-tight">{message}</span>
        <Link
          href="/comparativo"
          onClick={handleCtaClick}
          className="underline font-semibold hover:no-underline whitespace-nowrap"
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
