'use client'

import { useEffect, useState } from 'react'
import { ModalConfirmarCancelamento } from './ModalConfirmarCancelamento'
import { ModalSubstituir }           from './ModalSubstituir'
import { Button } from '@/components/ui/Button'

type Props = {
  nota: {
    id: string
    numero_rps: number
    status: string
    emitida_em: string | null
    tomador_tipo?: string | null
  }
  empresaTipo: string
  abrirModal?: 'cancelar' | 'substituir'
}

function calcPrazos(emitidaEm: string, tomadorPublico: boolean) {
  const emissao = new Date(emitidaEm)
  const agora   = new Date()

  const limiteSubst  = new Date(emissao)
  limiteSubst.setDate(limiteSubst.getDate() + 9)

  const limiteCancel = new Date(emissao)
  limiteCancel.setDate(limiteCancel.getDate() + (tomadorPublico ? 365 : 90))

  const msPerDay = 1000 * 60 * 60 * 24
  const diasSubst  = Math.max(0, Math.ceil((limiteSubst.getTime()  - agora.getTime()) / msPerDay))
  const diasCancel = Math.max(0, Math.ceil((limiteCancel.getTime() - agora.getTime()) / msPerDay))

  return {
    podeSubstituir: agora < limiteSubst,
    podeCancelar:   agora < limiteCancel,
    diasSubst,
    diasCancel,
  }
}

export function AcoesDaNota({ nota, empresaTipo, abrirModal }: Props) {
  const [modalCancel, setModalCancel] = useState(abrirModal === 'cancelar')
  const [modalSubst,  setModalSubst]  = useState(abrirModal === 'substituir')

  // Sync when abrirModal prop changes (navigation via query param)
  useEffect(() => {
    if (abrirModal === 'cancelar')   setModalCancel(true)
    if (abrirModal === 'substituir') setModalSubst(true)
  }, [abrirModal])

  // Only for ME/EPP with authorized nota
  if (nota.status !== 'AUTORIZADA') return null
  if (empresaTipo === 'MEI')        return null
  if (!nota.emitida_em)             return null

  const tomadorPublico = nota.tomador_tipo === 'ORGAO_PUBLICO'
  const prazos  = calcPrazos(nota.emitida_em, tomadorPublico)
  const urgente = prazos.podeSubstituir && prazos.diasSubst <= 3

  return (
    <>
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-5">
        <h3 className="text-sm font-medium text-text-1 mb-4">Ações disponíveis</h3>

        <div className="space-y-3">
          {/* Substituir */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-1">Substituir nota</p>
              {prazos.podeSubstituir ? (
                <p className={`text-xs mt-0.5 ${urgente ? 'text-nota-processando' : 'text-text-2'}`}>
                  {urgente && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full
                                     bg-nota-processando animate-pulse mr-1.5" />
                  )}
                  {prazos.diasSubst} dia{prazos.diasSubst !== 1 ? 's' : ''} restantes
                </p>
              ) : (
                <p className="text-xs text-nota-cancelada mt-0.5">Prazo de 9 dias encerrado</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setModalSubst(true)}
              disabled={!prazos.podeSubstituir}
            >
              Substituir
            </Button>
          </div>

          <div className="border-t border-navy-600" />

          {/* Cancelar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-1">Cancelar nota</p>
              {prazos.podeCancelar ? (
                <p className="text-xs text-text-2 mt-0.5">
                  {prazos.diasCancel} dia{prazos.diasCancel !== 1 ? 's' : ''} restantes
                  {tomadorPublico && ' (setor público: 365 dias)'}
                </p>
              ) : (
                <p className="text-xs text-nota-cancelada mt-0.5">
                  Prazo encerrado — via processo administrativo
                </p>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setModalCancel(true)}
              disabled={!prazos.podeCancelar}
            >
              Cancelar
            </Button>
          </div>
        </div>

        {!prazos.podeSubstituir && !prazos.podeCancelar && (
          <p className="text-xs text-text-2 mt-4 pt-4 border-t border-navy-600">
            Prazos de substituição e cancelamento encerrados. Para cancelamento
            após 90 dias, abra processo administrativo na prefeitura do município.
          </p>
        )}
      </div>

      {modalCancel && (
        <ModalConfirmarCancelamento
          nota={nota}
          onClose={() => setModalCancel(false)}
        />
      )}
      {modalSubst && (
        <ModalSubstituir
          nota={nota}
          onClose={() => setModalSubst(false)}
        />
      )}
    </>
  )
}
