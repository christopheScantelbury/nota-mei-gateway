'use client'

import { useEffect, useState } from 'react'

function useDiasRestantes(dataAlvo: Date): number {
  const [dias, setDias] = useState(0)

  useEffect(() => {
    const calc = () => {
      const diff = dataAlvo.getTime() - new Date().getTime()
      setDias(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))))
    }
    calc()
    const timer = setInterval(calc, 60_000)
    return () => clearInterval(timer)
  }, [dataAlvo])

  return dias
}

export function UrgencyBannerME() {
  const [dismissado, setDismissado] = useState(false)
  const PRAZO = new Date('2026-09-01T00:00:00-04:00')
  const dias = useDiasRestantes(PRAZO)

  useEffect(() => {
    setDismissado(sessionStorage.getItem('banner-me-dismissado') === '1')
  }, [])

  if (dismissado) return null

  const urgente = dias <= 30

  return (
    <div
      className={`relative flex items-center justify-center gap-3 px-4 py-2.5 text-sm
                  font-medium text-center
                  ${urgente
                    ? 'bg-nota-rejeitada/10 border-b border-nota-rejeitada/30 text-nota-rejeitada'
                    : 'bg-nota-processando/10 border-b border-nota-processando/30 text-nota-processando'
                  }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0
                        ${urgente ? 'bg-nota-rejeitada' : 'bg-nota-processando'} animate-pulse`} />

      <span>
        <strong>ME e EPP no Simples Nacional:</strong>{' '}
        NFS-e Nacional obrigatória em{' '}
        <strong>01/09/2026</strong>
        {dias > 0 && (
          <span className="ml-1 opacity-75">
            — {dias} dia{dias !== 1 ? 's' : ''}
          </span>
        )}
        {' · '}
        <a
          href="/me/cadastro"
          className="underline underline-offset-2 hover:no-underline"
        >
          Cadastre sua ME gratuitamente
        </a>
        {' · '}
        <a
          href="https://www.in.gov.br/web/dou/-/resolucao-cgsn-n-189-de-23-de-abril-de-2026"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          Res. CGSN 189/2026
        </a>
      </span>

      <button
        onClick={() => {
          sessionStorage.setItem('banner-me-dismissado', '1')
          setDismissado(true)
        }}
        aria-label="Fechar aviso"
        className="absolute right-3 opacity-50 hover:opacity-100 transition-opacity
                   text-lg leading-none"
      >
        ×
      </button>
    </div>
  )
}
