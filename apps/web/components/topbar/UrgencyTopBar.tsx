'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isTopbarDismissed, dismissTopbar } from '@/lib/cookies/topbar'
import { VIGENCIA_DATE } from '@/lib/dates/countdown'
import { trackTopbarView, trackTopbarDismiss, trackCtaClick } from '@/lib/analytics/events'

/**
 * Barra fixa no topo com mensagem de urgência regulatória.
 *
 * Spec: HIST-1.1. Troca a mensagem automaticamente após 01/09/2026 (D-15).
 * Cookie de dismiss persiste 7 dias (D-14).
 *
 * @example
 * <UrgencyTopBar />
 */
export default function UrgencyTopBar() {
  const [visible, setVisible] = useState(false)
  const [isPostVigencia, setIsPostVigencia] = useState(false)

  useEffect(() => {
    const dismissed = isTopbarDismissed()
    setIsPostVigencia(new Date() >= VIGENCIA_DATE)
    setVisible(!dismissed)
    if (!dismissed) trackTopbarView()
  }, [])

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
      role="region"
      aria-label="Aviso de urgência regulatória"
      className="relative w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs sm:text-sm py-2 px-10 sm:px-4"
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
