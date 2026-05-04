'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface Props {
  notaId: string
  webhookUrl: string
  entregue: boolean
  tentativas: number
}

export default function WebhookDeliveryLog({
  notaId,
  webhookUrl,
  entregue,
  tentativas,
}: Props) {
  const [sending,    setSending]    = useState(false)
  const [localState, setLocalState] = useState({ entregue, tentativas })

  async function handleResend() {
    setSending(true)
    try {
      const res = await fetch(`/api/notas/${notaId}/webhook/resend`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? `Erro ${res.status}`)
      }
      const data = await res.json()
      setLocalState({ entregue: data.entregue, tentativas: data.tentativas })
      if (data.entregue) {
        toast.success('Webhook entregue com sucesso!')
      } else {
        toast.info('Webhook reenviado. Aguardando confirmação do destino.')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao reenviar webhook.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-navy-600 overflow-hidden mb-6">
      <div className="bg-navy-700 px-5 py-3 border-b border-navy-600 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-2 uppercase tracking-wider">
          Entrega do Webhook
        </h2>
        {!localState.entregue && (
          <button
            onClick={handleResend}
            disabled={sending}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-cyan border border-brand-cyan/30 rounded-lg px-3 py-1.5 hover:bg-brand-cyan/10 transition disabled:opacity-50"
          >
            {sending && (
              <span className="w-3 h-3 rounded-full border-2 border-brand-cyan/40 border-t-brand-cyan animate-spin" />
            )}
            Reenviar agora
          </button>
        )}
      </div>

      <dl className="divide-y divide-navy-600">
        <div className="flex px-5 py-3 gap-4">
          <dt className="w-44 shrink-0 text-sm text-text-2">URL do destino</dt>
          <dd className="text-sm font-mono text-text-1 break-all">{webhookUrl}</dd>
        </div>
        <div className="flex px-5 py-3 gap-4">
          <dt className="w-44 shrink-0 text-sm text-text-2">Status</dt>
          <dd className="text-sm">
            {localState.entregue ? (
              <span className="flex items-center gap-1.5 text-nota-autorizada">
                <span className="w-2 h-2 rounded-full bg-nota-autorizada" />
                Entregue com sucesso
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-nota-processando">
                <span className="w-2 h-2 rounded-full bg-nota-processando" />
                Pendente
              </span>
            )}
          </dd>
        </div>
        <div className="flex px-5 py-3 gap-4">
          <dt className="w-44 shrink-0 text-sm text-text-2">Tentativas</dt>
          <dd className="text-sm font-mono">{localState.tentativas}</dd>
        </div>
        {!localState.entregue && (
          <div className="px-5 py-3">
            <p className="text-xs text-text-2 leading-relaxed">
              O sistema retenta automaticamente após{' '}
              <strong className="text-text-1">1 min → 5 min → 30 min</strong>.
              Use o botão &quot;Reenviar agora&quot; para forçar uma nova tentativa imediata.
            </p>
          </div>
        )}
      </dl>
    </div>
  )
}
