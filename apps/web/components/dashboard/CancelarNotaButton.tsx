'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

interface Props {
  notaId: string
  numeroRps: number
}

export default function CancelarNotaButton({ notaId, numeroRps }: Props) {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/notas/${notaId}/cancelar`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Erro ${res.status}`)
      }
      toast.success('Nota cancelada com sucesso.')
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar nota'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Cancelar nota
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 id="cancel-dialog-title" className="font-display text-xl font-extrabold mb-2">
              Cancelar nota #{numeroRps}?
            </h2>
            <p className="text-sm text-text-2 mb-6">
              Esta ação é irreversível. A nota será cancelada junto à Receita Federal e um
              evento <code className="font-mono text-xs bg-navy-600 px-1 rounded">nfse.cancelada</code>{' '}
              será enviado para o webhook configurado.
            </p>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleCancel}
                loading={loading}
              >
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
