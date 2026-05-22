'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import RecorrenciaModal from '@/components/dashboard/RecorrenciaModal'
import { formatBRL } from '@/lib/format'

interface Recorrencia {
  id: string
  nome: string
  ativo: boolean
  dia_vencimento: number
  proxima_emissao: string
  webhook_url?: string
  servico: unknown
  tomador: unknown
}

interface Props {
  initialData: Recorrencia[]
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function ServicoBadge({ servico }: { servico: unknown }) {
  const s = servico as Record<string, unknown> | null
  if (!s) return null
  return (
    <span className="font-mono text-xs text-text-2">
      {String(s.codigo_nbs ?? '—')}
      {s.valor != null && (
        <> · {formatBRL(Number(s.valor))}</>
      )}
    </span>
  )
}

export default function RecorrenciasList({ initialData }: Props) {
  const [list,    setList]    = useState<Recorrencia[]>(initialData)
  const [modal,   setModal]   = useState<'new' | Recorrencia | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleSaved = useCallback((saved: Recorrencia) => {
    setList(prev => {
      const exists = prev.findIndex(r => r.id === saved.id)
      if (exists >= 0) {
        const next = [...prev]; next[exists] = saved; return next
      }
      return [saved, ...prev]
    })
    setModal(null)
    toast.success(modal === 'new' ? 'Recorrência criada!' : 'Recorrência atualizada!')
  }, [modal])

  const handleToggle = useCallback(async (rec: Recorrencia) => {
    try {
      const res = await fetch(`/api/recorrencias/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !rec.ativo }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setList(prev => prev.map(r => r.id === rec.id ? updated : r))
    } catch {
      toast.error('Não foi possível alterar o status da recorrência.')
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Excluir esta recorrência? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/recorrencias/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error()
      setList(prev => prev.filter(r => r.id !== id))
      toast.success('Recorrência excluída.')
    } catch {
      toast.error('Não foi possível excluir a recorrência.')
    } finally {
      setDeleting(null)
    }
  }, [])

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Automação</h1>
          <p className="text-text-2 text-sm mt-1">
            Regras de emissão recorrente — a nota é emitida automaticamente no dia configurado.
          </p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="text-sm font-semibold bg-brand-cyan text-navy-900 px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          + Nova regra
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-navy-600 bg-navy-700/30 px-6 py-16 text-center">
          <div className="text-4xl mb-3">🔄</div>
          <p className="font-display text-lg font-bold mb-2">Nenhuma regra configurada</p>
          <p className="text-text-2 text-sm mb-6">
            Crie uma regra e a nota será emitida automaticamente todo mês no dia escolhido.
          </p>
          <button
            onClick={() => setModal('new')}
            className="text-sm font-semibold bg-brand-cyan text-navy-900 px-5 py-2.5 rounded-lg hover:opacity-90 transition"
          >
            Criar primeira regra
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-navy-600 overflow-hidden">
          {/* Header row */}
          <div className="bg-navy-700 px-5 py-3 border-b border-navy-600 hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
            {['Nome', 'Serviço', 'Dia', 'Próxima emissão', ''].map(h => (
              <span key={h} className="text-xs font-semibold text-text-2 uppercase tracking-wider">{h}</span>
            ))}
          </div>

          <ul className="divide-y divide-navy-600">
            {list.map(rec => (
              <li
                key={rec.id}
                className="px-5 py-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 md:gap-4 items-center"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate">{rec.nome}</span>
                  <Badge variant={rec.ativo ? 'success' : 'neutral'}>
                    {rec.ativo ? 'Ativa' : 'Pausada'}
                  </Badge>
                </div>
                <ServicoBadge servico={rec.servico} />
                <span className="text-sm text-text-2">
                  Dia <span className="font-mono">{rec.dia_vencimento}</span>
                </span>
                <span className="text-sm font-mono text-brand-cyan">
                  {formatDate(rec.proxima_emissao)}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleToggle(rec)}
                    className="text-xs px-2.5 py-1 rounded border border-navy-600 text-text-2 hover:text-text-1 hover:border-navy-600/60 transition"
                  >
                    {rec.ativo ? 'Pausar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setModal(rec)}
                    className="text-xs px-2.5 py-1 rounded border border-navy-600 text-text-2 hover:text-brand-cyan hover:border-brand-cyan/40 transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    disabled={deleting === rec.id}
                    className="text-xs px-2.5 py-1 rounded border border-nota-rejeitada/30 text-nota-rejeitada hover:bg-nota-rejeitada/10 transition disabled:opacity-50"
                  >
                    {deleting === rec.id ? '…' : 'Excluir'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modal !== null && (
        <RecorrenciaModal
          existing={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}
