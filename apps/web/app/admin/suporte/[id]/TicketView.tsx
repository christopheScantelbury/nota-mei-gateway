'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'
import { PRIORIDADE_LABEL, STATUS_LABEL, type MensagemAutor, type TicketPrioridade, type TicketStatus } from '@/lib/suporte/types'

interface Msg {
  id: string
  autor: MensagemAutor
  conteudo: string
  anexo_url: string | null
  created_at: string
  ferramentas: string[]
}

const ROTULO: Record<MensagemAutor, string> = {
  cliente: 'Cliente',
  ia: 'IA',
  atendente: 'Equipe',
  interno: 'Nota interna',
  sistema: 'Sistema',
}

export default function TicketView({
  ticketId, status, prioridade, assumidoPorMim, podeEscrever, mensagens,
}: {
  ticketId: string
  status: TicketStatus
  prioridade: TicketPrioridade
  assumidoPorMim: boolean
  podeEscrever: boolean
  mensagens: Msg[]
}) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [interno, setInterno] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [pending, startTransition] = useTransition()
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fimRef.current?.scrollIntoView({ block: 'end' }) }, [mensagens.length])
  // Atualiza a conversa enquanto o chamado está aberto.
  useEffect(() => {
    if (status === 'resolvido') return
    const id = setInterval(() => router.refresh(), 15000)
    return () => clearInterval(id)
  }, [status, router])

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/admin/api/suporte/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      notify.error('Não foi possível atualizar', d.message ?? `Erro ${res.status}`)
      return
    }
    startTransition(() => router.refresh())
  }

  async function responder() {
    const conteudo = texto.trim()
    if (!conteudo) return
    setEnviando(true)
    try {
      const res = await fetch(`/admin/api/suporte/${ticketId}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo, interno }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        notify.error('Mensagem não enviada', d.message ?? `Erro ${res.status}`)
        return
      }
      setTexto('')
      notify.success(interno ? 'Nota interna salva' : 'Resposta enviada', interno ? undefined : 'O cliente vê no chat e recebe aviso por e-mail.', { skipScroll: true })
      startTransition(() => router.refresh())
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-xl border border-navy-600 bg-navy-700 flex flex-col min-h-[520px]">
      {podeEscrever && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-navy-600 text-sm">
          {!assumidoPorMim && status !== 'resolvido' && (
            <button onClick={() => void patch({ assumir: true })} disabled={pending} className="px-3 py-1.5 rounded-lg bg-nota-upgrade/20 text-nota-upgrade border border-nota-upgrade/30 disabled:opacity-50">
              Assumir (tira a IA)
            </button>
          )}
          <label className="flex items-center gap-1 text-text-2">
            Status
            <select
              value={status}
              onChange={(e) => void patch({ status: e.target.value })}
              disabled={pending}
              className="bg-navy-900 border border-navy-600 rounded px-2 py-1 text-text-1"
            >
              {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1 text-text-2">
            Prioridade
            <select
              value={prioridade}
              onChange={(e) => void patch({ prioridade: e.target.value })}
              disabled={pending}
              className="bg-navy-900 border border-navy-600 rounded px-2 py-1 text-text-1"
            >
              {(Object.keys(PRIORIDADE_LABEL) as TicketPrioridade[]).map((p) => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto max-h-[60vh] px-4 py-4 space-y-3">
        {mensagens.map((m) => (
          <div key={m.id} className={m.autor === 'sistema' ? 'text-center' : ''}>
            {m.autor === 'sistema' ? (
              <p className="text-xs text-text-2">{m.conteudo} · {new Date(m.created_at).toLocaleString('pt-BR')}</p>
            ) : (
              <div
                className={`rounded-lg p-3 text-sm border ${
                  m.autor === 'cliente' ? 'bg-navy-800 border-navy-600'
                  : m.autor === 'ia' ? 'bg-nota-upgrade/10 border-nota-upgrade/20'
                  : m.autor === 'interno' ? 'bg-nota-processando/10 border-nota-processando/30 border-dashed'
                  : 'bg-brand-cyan/10 border-brand-cyan/25'
                }`}
              >
                <p className="text-xs text-text-2 mb-1">
                  <span className="font-semibold text-text-1">{ROTULO[m.autor]}</span> · {new Date(m.created_at).toLocaleString('pt-BR')}
                  {m.ferramentas.length > 0 && <span> · consultou: {Array.from(new Set(m.ferramentas)).join(', ')}</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-text-1">{m.conteudo}</p>
                {m.anexo_url && (
                  <a href={m.anexo_url} target="_blank" rel="noopener noreferrer" className="block mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.anexo_url} alt="Anexo do cliente" className="max-h-60 rounded border border-navy-600" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      {podeEscrever && (
        <div className="border-t border-navy-600 p-3 space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={8000}
            placeholder={interno ? 'Nota interna — o cliente NÃO vê' : 'Resposta para o cliente (ele vê no chat e recebe e-mail)'}
            className={`w-full resize-y bg-navy-900 border rounded-lg px-3 py-2 text-sm ${interno ? 'border-nota-processando/50' : 'border-navy-600'}`}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-text-2">
              <input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />
              Nota interna
            </label>
            <button
              onClick={() => void responder()}
              disabled={enviando || !texto.trim()}
              className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 font-semibold text-sm disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : interno ? 'Salvar nota' : 'Responder'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
