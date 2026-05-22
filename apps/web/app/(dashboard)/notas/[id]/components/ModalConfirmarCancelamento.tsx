'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

const MOTIVOS = [
  { valor: 1, label: 'Erro na emissão' },
  { valor: 2, label: 'Serviço não prestado' },
  { valor: 3, label: 'Duplicidade de nota' },
  { valor: 4, label: 'Erro na discriminação do serviço' },
]

type Props = {
  nota: { id: string; numero_rps: number }
  onClose: () => void
}

export function ModalConfirmarCancelamento({ nota, onClose }: Props) {
  const [motivo,  setMotivo]  = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')
  const router = useRouter()

  const confirmar = async () => {
    setLoading(true)
    setErro('')

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
    const res = await fetch(
      `${apiBase}/v1/nfse/${nota.id}?codigo=${motivo}`,
      { method: 'DELETE', credentials: 'include' }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setErro(err.message || 'Erro ao cancelar. Tente novamente.')
      setLoading(false)
      return
    }

    router.refresh()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                  bg-navy-900/80 backdrop-blur-sm px-4"
      onClick={(e) => { if (!loading && e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-navy-600
                      bg-navy-700 p-6 shadow-2xl">
        <h3 className="font-medium text-text-1 text-lg mb-2">
          Cancelar nota #{nota.numero_rps}
        </h3>

        <div className="rounded-lg border border-nota-processando/20 bg-nota-processando/5
                        p-3 text-xs text-nota-processando mb-5">
          ⚠️ Esta ação é irreversível. O cancelamento não suspende
          automaticamente o débito de ISS.
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium text-text-2 mb-2 block">
            Motivo do cancelamento
          </label>
          <div className="space-y-2">
            {MOTIVOS.map((m) => (
              <label key={m.valor} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="motivo"
                  value={m.valor}
                  checked={motivo === m.valor}
                  onChange={() => setMotivo(m.valor)}
                  className="accent-brand-cyan"
                />
                <span className="text-sm text-text-2">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {erro && (
          <p className="text-xs text-nota-rejeitada bg-nota-rejeitada/5
                        border border-nota-rejeitada/20 rounded-lg px-3 py-2 mb-4">
            {erro}
          </p>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Voltar
          </Button>
          <Button variant="danger" className="flex-1" onClick={confirmar} loading={loading}>
            {loading ? 'Cancelando...' : 'Confirmar cancelamento'}
          </Button>
        </div>
      </div>
    </div>
  )
}
