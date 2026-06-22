'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'

interface Row {
  id: string
  user_email?: string | null
  empresa_id: string | null
  tipo: 'bug' | 'sugestao' | 'duvida' | 'elogio'
  mensagem: string
  url: string | null
  user_agent: string | null
  screenshot_url: string | null
  status: 'open' | 'triaging' | 'resolved' | 'wontfix'
  notes_admin: string | null
  created_at: string
}

const TIPO_LABEL: Record<Row['tipo'], { label: string; icon: string }> = {
  bug:      { label: 'Bug',      icon: '🐛' },
  sugestao: { label: 'Sugestão', icon: '💡' },
  duvida:   { label: 'Dúvida',   icon: '❓' },
  elogio:   { label: 'Elogio',   icon: '💚' },
}

const STATUS_LABEL: Record<Row['status'], { label: string; cls: string }> = {
  open:     { label: 'aberto',    cls: 'bg-nota-rejeitada/10 text-nota-rejeitada' },
  triaging: { label: 'analisando', cls: 'bg-nota-processando/10 text-nota-processando' },
  resolved: { label: 'resolvido', cls: 'bg-nota-autorizada/10 text-nota-autorizada' },
  wontfix:  { label: 'wontfix',   cls: 'bg-navy-600 text-text-2' },
}

export default function FeedbackList({
  initialItems,
  canWrite,
  filterStatus,
  filterTipo,
}: {
  initialItems: Row[]
  canWrite: boolean
  filterStatus: string | null
  filterTipo: string | null
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((i) => i.id === selectedId) ?? null

  function setFilter(key: 'status' | 'tipo', value: string | null) {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
    router.push(url.pathname + url.search)
  }

  async function updateStatus(id: string, status: Row['status'], notes?: string) {
    const res = await fetch(`/admin/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes_admin: notes }),
    })
    if (res.ok) {
      setItems((arr) =>
        arr.map((r) => (r.id === id ? { ...r, status, notes_admin: notes ?? r.notes_admin } : r)),
      )
      notify.success('Status atualizado')
    } else {
      notify.error('Erro', (await res.json()).message)
    }
  }

  return (
    <>
      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <FilterChip label="Todos" active={!filterStatus} onClick={() => setFilter('status', null)} />
        <FilterChip label="Abertos" active={filterStatus === 'open'} onClick={() => setFilter('status', 'open')} />
        <FilterChip label="Analisando" active={filterStatus === 'triaging'} onClick={() => setFilter('status', 'triaging')} />
        <FilterChip label="Resolvidos" active={filterStatus === 'resolved'} onClick={() => setFilter('status', 'resolved')} />
        <span className="border-r border-navy-600 mx-1" />
        <FilterChip label="Todos tipos" active={!filterTipo} onClick={() => setFilter('tipo', null)} />
        {(['bug', 'sugestao', 'duvida', 'elogio'] as const).map((t) => (
          <FilterChip
            key={t}
            label={`${TIPO_LABEL[t].icon} ${TIPO_LABEL[t].label}`}
            active={filterTipo === t}
            onClick={() => setFilter('tipo', t)}
          />
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-navy-600 p-12 text-center text-text-2">
          Nenhum feedback ainda.
        </div>
      ) : (
        <div className="rounded-xl border border-navy-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-700 border-b border-navy-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Quando</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Mensagem</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="border-b border-navy-600 last:border-0 hover:bg-navy-700/30 cursor-pointer"
                >
                  <td className="px-4 py-3 text-text-2 text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{TIPO_LABEL[r.tipo].icon} {TIPO_LABEL[r.tipo].label}</span>
                  </td>
                  <td className="px-4 py-3 text-text-2 text-xs">{r.user_email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-1 line-clamp-2">{r.mensagem}</p>
                    {r.screenshot_url && (
                      <p className="text-xs text-brand-cyan mt-0.5">📷 com screenshot</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_LABEL[r.status].cls}`}>
                      {STATUS_LABEL[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetailModal
          item={selected}
          canWrite={canWrite}
          onClose={() => setSelectedId(null)}
          onUpdate={(status, notes) => updateStatus(selected.id, status, notes)}
        />
      )}
    </>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-brand-cyan/10 border-brand-cyan text-brand-cyan'
          : 'border-navy-600 text-text-2 hover:border-navy-600/70'
      }`}
    >
      {label}
    </button>
  )
}

function DetailModal({
  item,
  canWrite,
  onClose,
  onUpdate,
}: {
  item: Row
  canWrite: boolean
  onClose: () => void
  onUpdate: (status: Row['status'], notes?: string) => Promise<void>
}) {
  const [notes, setNotes] = useState(item.notes_admin ?? '')
  const [saving, setSaving] = useState(false)

  async function setStatus(status: Row['status']) {
    setSaving(true)
    await onUpdate(status, notes || undefined)
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">
              {TIPO_LABEL[item.tipo].icon} {TIPO_LABEL[item.tipo].label}
            </h2>
            <p className="text-xs text-text-2 mt-1">
              {new Date(item.created_at).toLocaleString('pt-BR')} · {item.user_email ?? 'anônimo'}
            </p>
          </div>
          <button onClick={onClose} className="text-text-2 hover:text-text-1 text-xl leading-none">×</button>
        </div>

        <div className="space-y-4">
          <Field label="Mensagem">
            <p className="text-sm whitespace-pre-wrap text-text-1 bg-navy-800 border border-navy-600 rounded p-3">
              {item.mensagem}
            </p>
          </Field>

          {item.url && (
            <Field label="URL">
              <a href={item.url} target="_blank" rel="noreferrer" className="text-brand-cyan text-xs break-all hover:underline">
                {item.url}
              </a>
            </Field>
          )}

          {item.screenshot_url && (
            <Field label="Screenshot">
              <a href={item.screenshot_url} target="_blank" rel="noreferrer">
                <img src={item.screenshot_url} alt="screenshot" className="max-h-64 rounded border border-navy-600" />
              </a>
            </Field>
          )}

          {item.user_agent && (
            <Field label="User Agent">
              <p className="text-xs text-text-2 font-mono break-all">{item.user_agent}</p>
            </Field>
          )}

          {canWrite && (
            <Field label="Notas admin (interno)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-navy-800 border border-navy-600 rounded p-2 text-sm"
              />
            </Field>
          )}

          {canWrite && (
            <div className="flex gap-2 flex-wrap pt-2">
              <StatusButton current={item.status} target="triaging" onClick={() => setStatus('triaging')} saving={saving} />
              <StatusButton current={item.status} target="resolved" onClick={() => setStatus('resolved')} saving={saving} />
              <StatusButton current={item.status} target="wontfix" onClick={() => setStatus('wontfix')} saving={saving} />
              <StatusButton current={item.status} target="open" onClick={() => setStatus('open')} saving={saving} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">{label}</label>
      {children}
    </div>
  )
}

function StatusButton({ current, target, onClick, saving }: { current: Row['status']; target: Row['status']; onClick: () => void; saving: boolean }) {
  const isCurrent = current === target
  return (
    <button
      onClick={onClick}
      disabled={isCurrent || saving}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        isCurrent
          ? `${STATUS_LABEL[target].cls} border-current opacity-70 cursor-default`
          : 'border-navy-600 hover:border-brand-cyan'
      }`}
    >
      {isCurrent ? `✓ ${STATUS_LABEL[target].label}` : `Marcar ${STATUS_LABEL[target].label}`}
    </button>
  )
}
