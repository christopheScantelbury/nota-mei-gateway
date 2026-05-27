'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import RecorrenciaModal from '@/components/dashboard/RecorrenciaModal'
import { formatBRL } from '@/lib/format'
import { Button } from '@/components/ui/Button'

interface Recorrencia {
  id:                     string
  nome:                   string
  ativo:                  boolean
  dia_vencimento:         number
  proxima_emissao:        string
  webhook_url?:           string | null
  servico:                unknown
  tomador:                unknown
  enviar_email_tomador?:  boolean
  email_tomador?:         string | null
}

interface Props {
  initialData: Recorrencia[]
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function diasAteProxima(iso: string): number {
  const target = new Date(iso).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / 86400_000)
}

export default function RecorrenciasList({ initialData }: Props) {
  const [list, setList]         = useState<Recorrencia[]>(initialData)
  const [modal, setModal]       = useState<'new' | Recorrencia | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleSaved = useCallback((saved: Recorrencia) => {
    setList(prev => {
      const exists = prev.findIndex(r => r.id === saved.id)
      if (exists >= 0) {
        const next = [...prev]; next[exists] = saved; return next
      }
      return [saved, ...prev]
    })
    setModal(null)
    toast.success(modal === 'new' ? 'Automação criada!' : 'Automação atualizada!')
  }, [modal])

  const handleToggle = useCallback(async (rec: Recorrencia) => {
    setToggling(rec.id)
    try {
      const res = await fetch(`/api/recorrencias/${rec.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !rec.ativo }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setList(prev => prev.map(r => r.id === rec.id ? updated : r))
      toast.success(updated.ativo ? 'Automação ativada' : 'Automação pausada')
    } catch {
      toast.error('Não foi possível alterar o status.')
    } finally {
      setToggling(null)
    }
  }, [])

  const handleDelete = useCallback(async (rec: Recorrencia) => {
    if (!confirm(`Excluir "${rec.nome}"?\n\nAs notas já emitidas por essa automação são preservadas.`)) return
    setDeleting(rec.id)
    try {
      const res = await fetch(`/api/recorrencias/${rec.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) throw new Error()
      setList(prev => prev.filter(r => r.id !== rec.id))
      toast.success('Automação excluída.')
    } catch {
      toast.error('Não foi possível excluir.')
    } finally {
      setDeleting(null)
    }
  }, [])

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Automações</h1>
          <p className="text-text-2 text-sm mt-1">
            Emita notas automaticamente todo mês, sem precisar abrir o sistema.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setModal('new')} className="shrink-0 sm:w-auto">
          + Nova automação
        </Button>
      </div>

      {/* Empty state */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy-600 px-6 py-16 text-center">
          <div className="text-5xl mb-4">🔄</div>
          <p className="font-display text-lg font-bold mb-2">Sem automações ainda</p>
          <p className="text-text-2 text-sm mb-6 max-w-md mx-auto">
            Configure uma regra e a nota é emitida sozinha todo mês.
            Opcionalmente o cliente recebe a NFS-e por email automaticamente.
          </p>
          <Button variant="primary" onClick={() => setModal('new')}>
            Criar primeira automação
          </Button>
        </div>
      ) : (
        <>
          {/* ── Mobile: cards (< sm) ── */}
          <div className="sm:hidden space-y-3">
            {list.map(rec => {
              const dias = diasAteProxima(rec.proxima_emissao)
              const s = rec.servico as Record<string, unknown> | null
              return (
                <div key={rec.id} className="rounded-xl border border-navy-600 bg-navy-700/50 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{rec.nome}</p>
                      {s?.valor != null && (
                        <p className="text-xs text-text-2 mt-0.5">
                          {formatBRL(Number(s.valor))} · todo dia {rec.dia_vencimento}
                        </p>
                      )}
                    </div>
                    <Badge variant={rec.ativo ? 'success' : 'neutral'}>
                      {rec.ativo ? 'Ativa' : 'Pausada'}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-2 mb-3">
                    <span className="inline-flex items-center gap-1 bg-navy-900 border border-navy-600 rounded-full px-2 py-0.5">
                      📅 {formatDate(rec.proxima_emissao)}
                      {rec.ativo && dias >= 0 && dias <= 7 && (
                        <span className="text-brand-cyan ml-1">· em {dias === 0 ? 'hoje' : `${dias}d`}</span>
                      )}
                    </span>
                    {rec.enviar_email_tomador && (
                      <span className="inline-flex items-center gap-1 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan rounded-full px-2 py-0.5">
                        ✉️ Auto-email
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggle(rec)}
                      loading={toggling === rec.id}
                      className="flex-1"
                    >
                      {rec.ativo ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setModal(rec)}
                      className="flex-1"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(rec)}
                      disabled={deleting === rec.id}
                      className="text-nota-rejeitada hover:bg-nota-rejeitada/10 px-3"
                      aria-label="Excluir"
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop: table (≥ sm) ── */}
          <div className="hidden sm:block rounded-xl border border-navy-600 overflow-hidden">
            <div className="bg-navy-700 px-5 py-3 border-b border-navy-600 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
              {['Nome', 'Serviço', 'Dia', 'Próxima', ''].map(h => (
                <span key={h} className="text-xs font-semibold text-text-2 uppercase tracking-wider">{h}</span>
              ))}
            </div>
            <ul className="divide-y divide-navy-600">
              {list.map(rec => {
                const s = rec.servico as Record<string, unknown> | null
                const dias = diasAteProxima(rec.proxima_emissao)
                return (
                  <li
                    key={rec.id}
                    className="px-5 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{rec.nome}</span>
                        <Badge variant={rec.ativo ? 'success' : 'neutral'}>
                          {rec.ativo ? 'Ativa' : 'Pausada'}
                        </Badge>
                        {rec.enviar_email_tomador && (
                          <span className="text-[10px] text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/30 rounded-full px-2 py-0.5 whitespace-nowrap">
                            ✉️ auto
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-mono text-text-2">
                      {s?.valor != null ? formatBRL(Number(s.valor)) : '—'}
                    </span>
                    <span className="text-sm text-text-2">
                      Dia <span className="font-mono">{rec.dia_vencimento}</span>
                    </span>
                    <span className="text-sm font-mono text-brand-cyan">
                      {formatDate(rec.proxima_emissao)}
                      {rec.ativo && dias >= 0 && dias <= 7 && (
                        <span className="text-text-2 text-xs ml-1">({dias === 0 ? 'hoje' : `${dias}d`})</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggle(rec)}
                        loading={toggling === rec.id}
                      >
                        {rec.ativo ? 'Pausar' : 'Ativar'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setModal(rec)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rec)}
                        disabled={deleting === rec.id}
                        className="text-nota-rejeitada hover:bg-nota-rejeitada/10"
                      >
                        {deleting === rec.id ? '…' : 'Excluir'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
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
