'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'urgency_banner_dismissed'

export default function UrgencyBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
        <p className="text-amber-800 text-sm leading-snug">
          <span className="font-semibold">⚠️ A partir de 2026,</span>{' '}
          todo MEI prestador de serviço é obrigado a emitir NFS-e pela Receita Federal Nacional.
          A gente já está pronto.{' '}
          <a
            href="/obrigatoriedade-nfse-mei"
            className="underline font-semibold hover:text-amber-900 transition"
          >
            Saiba mais →
          </a>
        </p>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="shrink-0 text-amber-600 hover:text-amber-900 transition text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
