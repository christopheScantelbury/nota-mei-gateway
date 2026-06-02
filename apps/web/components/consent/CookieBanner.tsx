'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { setConsent, getConsent } from '@/lib/analytics/consent'

/**
 * Banner LGPD para consent de cookies analíticos (GA4).
 *
 * Spec: HIST-7.1.
 * Aparece apenas na primeira visita. Persiste escolha por 12 meses em cookie.
 * Sem aceite, GA4 fica em `analytics_storage='denied'` e não envia eventos.
 *
 * @example
 * <CookieBanner />
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getConsent() === null)
  }, [])

  if (!visible) return null

  function accept() {
    setConsent('granted')
    setVisible(false)
  }
  function reject() {
    setConsent('denied')
    setVisible(false)
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md z-[80] bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-2xl shadow-xl p-4 sm:p-5"
    >
      <p className="text-sm text-slate-900 dark:text-text-1 font-semibold mb-1">
        Cookies analíticos
      </p>
      <p className="text-xs text-slate-600 dark:text-text-2 leading-relaxed mb-3">
        Usamos cookies pra entender como você navega e melhorar a experiência.
        Não compartilhamos seus dados.{' '}
        <Link href="/privacidade" className="underline hover:no-underline">
          Saiba mais
        </Link>
        .
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={accept}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-cyan text-navy-900 hover:opacity-90 transition"
        >
          Aceitar
        </button>
        <button
          onClick={reject}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-navy-500 text-slate-700 dark:text-text-2 hover:bg-slate-50 dark:hover:bg-navy-600 transition"
        >
          Apenas necessários
        </button>
      </div>
    </div>
  )
}
