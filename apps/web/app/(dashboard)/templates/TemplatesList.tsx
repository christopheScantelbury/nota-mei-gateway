'use client'

import { useState } from 'react'
import TemplateModal from '@/components/dashboard/TemplateModal'
import type { NotaTemplate } from '@/app/api/templates/route'
import { formatBRL } from '@/lib/format'
import { Button } from '@/components/ui/Button'

interface Props {
  initialTemplates: NotaTemplate[]
}

export default function TemplatesList({ initialTemplates }: Props) {
  const [templates, setTemplates]       = useState<NotaTemplate[]>(initialTemplates)
  const [modalOpen, setModalOpen]       = useState(false)
  const [editing, setEditing]           = useState<NotaTemplate | null>(null)
  const [deletingId, setDeletingId]     = useState<string | null>(null)
  const [deleteError, setDeleteError]   = useState('')

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(t: NotaTemplate) {
    setEditing(t)
    setModalOpen(true)
  }

  function handleSaved(saved: NotaTemplate) {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError('')
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setDeleteError('Não foi possível excluir o template. Tente novamente.')
        return
      }
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch {
      setDeleteError('Erro de conexão ao excluir.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-2">
          {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
        </p>
        <Button variant="primary" size="sm" onClick={openCreate}>
          + Novo template
        </Button>
      </div>

      {deleteError && (
        <p className="mb-4 text-xs text-nota-rejeitada bg-nota-rejeitada/10 border border-nota-rejeitada/30 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-navy-600 border-dashed">
          <span className="text-5xl mb-4">📄</span>
          <h3 className="font-display font-bold text-xl mb-2">
            Nenhum template criado
          </h3>
          <p className="text-text-2 text-sm max-w-xs mb-6">
            Crie templates para pré-preencher formulários de emissão e poupar
            tempo em notas recorrentes.
          </p>
          <Button variant="primary" onClick={openCreate}>
            + Criar primeiro template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div
              key={t.id}
              className="rounded-xl border border-navy-600 bg-navy-700 p-5 flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.nome}</p>
                  {t.descricao && (
                    <p className="text-xs text-text-2 mt-0.5 truncate">{t.descricao}</p>
                  )}
                </div>
                <span className="text-xs font-mono text-brand-cyan shrink-0">
                  {t.servico.codigo_nbs}
                </span>
              </div>

              {/* Service preview */}
              <p className="text-xs text-text-2 line-clamp-2 leading-relaxed">
                {t.servico.discriminacao}
              </p>

              {/* Metadata row */}
              <div className="flex items-center gap-3 text-xs text-text-2">
                <span className="font-mono font-semibold text-text-1">
                  {formatBRL(t.servico.valor)}
                </span>
                <span>·</span>
                <span>ISS {t.servico.aliquota_iss}%</span>
                {t.webhook_url && (
                  <>
                    <span>·</span>
                    <span className="truncate">webhook</span>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-navy-600">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(t)}
                  className="text-xs px-2"
                >
                  ✏️ Editar
                </Button>
                <span className="text-navy-600">·</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="text-xs px-2 hover:text-nota-rejeitada"
                >
                  {deletingId === t.id ? 'Excluindo…' : '🗑 Excluir'}
                </Button>
                <div className="flex-1" />
                <a
                  href={`/notas/nova?template=${t.id}`}
                  className="text-xs font-semibold text-brand-cyan hover:underline"
                >
                  Usar →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <TemplateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  )
}
