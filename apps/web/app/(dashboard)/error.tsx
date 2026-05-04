'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="rounded-xl border border-nota-rejeitada/30 bg-nota-rejeitada/5 p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="font-display text-xl font-extrabold text-text-1 mb-2">
          Algo deu errado
        </h2>
        <p className="text-text-2 text-sm mb-6">
          {error.message && error.message !== 'An unexpected error occurred'
            ? error.message
            : 'Ocorreu um erro inesperado ao carregar esta página.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="text-sm font-semibold bg-brand-cyan text-navy-900 px-5 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Tentar novamente
          </button>
          <a
            href="/home"
            className="text-sm font-semibold border border-navy-600 text-text-2 px-5 py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Ir para o início
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-text-2/50 mt-4 font-mono">Erro: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
