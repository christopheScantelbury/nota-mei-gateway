'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'

type Props = {
  nota: {
    id: string
    status: string
    emitida_em: string | null
    tomador_tipo?: string | null
  }
  empresaTipo: string
}

function calcPrazos(emitidaEm: string, tomadorPublico: boolean) {
  const emissao = new Date(emitidaEm)
  const agora   = new Date()

  const limiteSubst  = new Date(emissao)
  limiteSubst.setDate(limiteSubst.getDate() + 9)

  const limiteCancel = new Date(emissao)
  limiteCancel.setDate(limiteCancel.getDate() + (tomadorPublico ? 365 : 90))

  const msPerDay = 1000 * 60 * 60 * 24

  return {
    podeSubstituir: agora < limiteSubst,
    podeCancelar:   agora < limiteCancel,
    diasSubst:  Math.max(0, Math.ceil((limiteSubst.getTime()  - agora.getTime()) / msPerDay)),
  }
}

export function NotaActionsMenu({ nota, empresaTipo }: Props) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Only for ME/EPP with authorized nota
  if (nota.status !== 'AUTORIZADA' || empresaTipo === 'MEI') return null
  if (!nota.emitida_em) return null

  const tomadorPublico = nota.tomador_tipo === 'ORGAO_PUBLICO'
  const prazos = calcPrazos(nota.emitida_em, tomadorPublico)
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setAberto(!aberto)}
        aria-label="Ações da nota"
      >
        ⋯
      </Button>

      {aberto && (
        <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border
                        border-navy-600 bg-navy-700 shadow-xl overflow-hidden">
          <a
            href={`/notas/${nota.id}`}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-text-2
                       hover:bg-navy-600 hover:text-text-1 transition-colors"
          >
            Ver detalhes
          </a>

          {prazos.podeSubstituir && (
            <a
              href={`/notas/${nota.id}?acao=substituir`}
              className="flex items-center gap-2.5 px-4 py-3 text-sm text-text-2
                         hover:bg-navy-600 hover:text-text-1 transition-colors"
            >
              Substituir
              {prazos.diasSubst <= 3 && (
                <span className="ml-auto text-xs text-nota-processando">
                  {prazos.diasSubst}d
                </span>
              )}
            </a>
          )}

          {prazos.podeCancelar && (
            <a
              href={`/notas/${nota.id}?acao=cancelar`}
              className="flex items-center gap-2.5 px-4 py-3 text-sm text-nota-rejeitada
                         hover:bg-nota-rejeitada/10 transition-colors border-t border-navy-600"
            >
              Cancelar
            </a>
          )}

          <a
            href={`${apiBase}/v1/nfse/${nota.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-text-2
                       hover:bg-navy-600 hover:text-text-1 transition-colors
                       border-t border-navy-600"
          >
            Baixar PDF
          </a>
        </div>
      )}
    </div>
  )
}
