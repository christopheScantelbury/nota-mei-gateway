'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

type Delivery = {
  id: string
  tomador_nome: string | null
  valor_servico: number | null
  webhook_url: string | null
  webhook_entregue: boolean
  webhook_tentativas: number
  status: string
  created_at: string
  emitida_em: string | null
}

const EVENTS = [
  { key: 'nfse.autorizada',  label: 'nfse.autorizada',  desc: 'NFS-e aprovada pela Receita Federal' },
  { key: 'nfse.rejeitada',   label: 'nfse.rejeitada',   desc: 'NFS-e rejeitada com código de erro' },
  { key: 'nfse.cancelada',   label: 'nfse.cancelada',   desc: 'Cancelamento confirmado' },
]

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function formatBRL(v: number | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

interface Props { deliveries: Delivery[] }

export default function WebhooksConfig({ deliveries }: Props) {
  const [url, setUrl]           = useState('')
  const [saved, setSaved]       = useState(false)
  const [testing, setTesting]   = useState(false)
  const [events, setEvents]     = useState<Record<string, boolean>>({
    'nfse.autorizada': true,
    'nfse.rejeitada':  true,
    'nfse.cancelada':  true,
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('mei_webhook_default') ?? ''
    setUrl(stored)
  }, [])

  function saveUrl() {
    localStorage.setItem('mei_webhook_default', url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toast.success('URL de webhook salva.')
  }

  async function sendTest() {
    if (!url) return
    setTesting(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'nfse.teste',
          nota_id: '00000000-0000-0000-0000-000000000000',
          status: 'AUTORIZADA',
          numero_nfse: '000001',
          codigo_verificacao: 'TESTE001',
          emitida_em: new Date().toISOString(),
          signature: 'sha256=test_payload_not_signed',
        }),
      })
      if (res.ok) {
        toast.success(`Payload de teste entregue — HTTP ${res.status}`)
      } else {
        toast.error(`Endpoint retornou HTTP ${res.status}`)
      }
    } catch {
      toast.error('Falha de conexão — URL inacessível ou CORS bloqueado.')
    } finally {
      setTesting(false)
    }
  }

  function toggleEvent(key: string) {
    setEvents(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const delivered = deliveries.filter(d => d.webhook_entregue).length
  const pending   = deliveries.filter(d => !d.webhook_entregue).length

  return (
    <div className="flex flex-col gap-8">

      {/* URL config */}
      <div className="rounded-xl border border-navy-600 bg-navy-700 p-6 space-y-4">
        <h2 className="font-semibold text-text-1">Endpoint de webhook</h2>
        <p className="text-xs text-navy-600 bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-text-2">
          💡 A URL padrão é salva localmente. Em breve será sincronizada com a sua conta.
        </p>
        <div className="flex gap-3">
          <input
            type="url"
            className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition"
            placeholder="https://seu-erp.com/webhooks/nfse"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button
            onClick={saveUrl}
            disabled={!url}
            className="px-4 py-2.5 bg-brand-cyan text-navy-900 font-semibold text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {saved ? '✓ Salvo' : 'Salvar'}
          </button>
          <button
            onClick={sendTest}
            disabled={testing || !url}
            className="px-4 py-2.5 border border-navy-600 text-text-2 font-semibold text-sm rounded-lg hover:border-brand-cyan hover:text-text-1 transition disabled:opacity-50"
          >
            {testing ? '…' : 'Testar'}
          </button>
        </div>
      </div>

      {/* Event subscriptions */}
      <div className="rounded-xl border border-navy-600 overflow-hidden">
        <div className="px-5 py-3 border-b border-navy-600 bg-navy-700/50">
          <p className="font-semibold text-sm text-text-1">Eventos monitorados</p>
          <p className="text-xs text-text-2 mt-0.5">Todos os eventos ativos são enviados para sua URL sempre que ocorrem.</p>
        </div>
        {EVENTS.map((ev, i) => (
          <div
            key={ev.key}
            className={`flex items-center gap-4 px-5 py-3 ${i > 0 ? 'border-t border-navy-600' : ''}`}
          >
            <button
              role="switch"
              aria-checked={events[ev.key]}
              onClick={() => toggleEvent(ev.key)}
              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${events[ev.key] ? 'bg-brand-cyan' : 'bg-navy-600'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${events[ev.key] ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <div className="flex-1 min-w-0">
              <code className="text-xs font-mono text-brand-cyan">{ev.label}</code>
              <p className="text-xs text-text-2">{ev.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Retry policy */}
      <div className="rounded-xl border border-navy-600 bg-navy-700/30 px-5 py-4">
        <p className="font-semibold text-sm text-text-1 mb-2">Política de retry</p>
        <div className="flex flex-wrap gap-2">
          {['Imediato', '1 min', '5 min', '30 min', '2 h'].map((label, i) => (
            <span key={i} className="text-xs bg-navy-700 border border-navy-600 rounded-full px-3 py-1 text-text-2">
              {i + 1}ª tentativa{i === 0 ? '' : ` — ${label}`}
            </span>
          ))}
        </div>
        <p className="text-xs text-text-2 mt-3">
          Após 5 tentativas sem sucesso, o webhook é marcado como falho.
          Use o botão &quot;Reenviar agora&quot; na página da nota para forçar uma nova entrega.
        </p>
      </div>

      {/* Delivery history */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-1">
            Histórico de entregas
            <span className="ml-2 text-xs font-normal text-text-2">
              ({delivered} entregue{delivered !== 1 ? 's' : ''}, {pending} pendente{pending !== 1 ? 's' : ''})
            </span>
          </h2>
        </div>

        {deliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy-600 p-8 text-center">
            <p className="text-text-2 text-sm">Nenhuma nota emitida com webhook_url ainda.</p>
            <Link href="/notas/nova" className="mt-3 inline-block text-xs text-brand-cyan hover:underline">
              Emitir nova nota →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-navy-600 overflow-hidden">
            {deliveries.slice(0, 20).map((d, i) => (
              <div key={d.id} className={i > 0 ? 'border-t border-navy-600' : ''}>
                <button
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-navy-700/40 transition text-left"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${d.webhook_entregue ? 'bg-nota-autorizada' : 'bg-nota-processando'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.tomador_nome ?? '—'}</p>
                    <p className="text-xs text-text-2">{formatDate(d.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    d.webhook_entregue
                      ? 'text-nota-autorizada border-nota-autorizada/40 bg-nota-autorizada/10'
                      : 'text-nota-processando border-nota-processando/40 bg-nota-processando/10'
                  }`}>
                    {d.webhook_entregue ? 'Entregue' : `Pendente (${d.webhook_tentativas}x)`}
                  </span>
                  <span className="text-text-2 text-xs">{expandedId === d.id ? '▾' : '▸'}</span>
                </button>

                {expandedId === d.id && (
                  <div className="px-4 pb-3 border-t border-navy-600/50 bg-navy-900/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <p className="text-xs text-text-2">Valor</p>
                        <p className="text-sm font-mono">{formatBRL(d.valor_servico)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-2">Status da nota</p>
                        <p className="text-sm">{d.status}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-text-2 mb-0.5">URL destino</p>
                      <code className="text-xs font-mono text-brand-cyan break-all">{d.webhook_url}</code>
                    </div>
                    <Link
                      href={`/notas/${d.id}`}
                      className="inline-block text-xs text-brand-cyan hover:underline"
                    >
                      Ver nota completa →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
