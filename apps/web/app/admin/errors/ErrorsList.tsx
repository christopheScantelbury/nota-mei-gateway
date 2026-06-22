'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'

interface Row {
  id: string
  fingerprint: string
  level: 'error' | 'warning' | 'info'
  source: string
  message: string
  stack: string | null
  url: string | null
  user_id: string | null
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  resolved: boolean
}

const LEVEL_CLS: Record<Row['level'], string> = {
  error: 'bg-nota-rejeitada/10 text-nota-rejeitada',
  warning: 'bg-nota-processando/10 text-nota-processando',
  info: 'bg-brand-cyan/10 text-brand-cyan',
}

export default function ErrorsList({
  initialItems,
  canWrite,
  showResolved,
}: {
  initialItems: Row[]
  canWrite: boolean
  showResolved: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((i) => i.id === selectedId) ?? null

  function toggleResolved() {
    const url = new URL(window.location.href)
    if (showResolved) url.searchParams.delete('resolved')
    else url.searchParams.set('resolved', '1')
    router.push(url.pathname + url.search)
  }

  async function markResolved(id: string, resolved: boolean) {
    const res = await fetch(`/admin/api/errors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    })
    if (res.ok) {
      setItems((arr) => arr.filter((r) => r.id !== id))
      setSelectedId(null)
      notify.success(resolved ? 'Marcado como resolvido' : 'Reaberto')
    } else {
      notify.error('Erro', (await res.json()).message)
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-xs text-text-2">
          {showResolved ? 'Resolvidos' : 'Em aberto'} · {items.length} entries
        </p>
        <button
          onClick={toggleResolved}
          className="text-xs text-brand-cyan hover:underline"
        >
          {showResolved ? 'Ver em aberto' : 'Ver resolvidos'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-navy-600 p-12 text-center text-text-2">
          {showResolved ? 'Nenhum error resolvido ainda.' : '🎉 Nenhum error em aberto.'}
        </div>
      ) : (
        <div className="rounded-xl border border-navy-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy-700 border-b border-navy-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Última</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Mensagem</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-2 uppercase">×</th>
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
                    {new Date(r.last_seen_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${LEVEL_CLS[r.level]}`}>
                      {r.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-2 text-xs">{r.source}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-text-1 line-clamp-2 font-mono">{r.message}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-2 text-xs">
                    {r.occurrence_count}
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
          onResolve={() => markResolved(selected.id, !selected.resolved)}
        />
      )}
    </>
  )
}

function DetailModal({
  item,
  canWrite,
  onClose,
  onResolve,
}: {
  item: Row
  canWrite: boolean
  onClose: () => void
  onResolve: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className={`text-xs px-2 py-0.5 rounded inline-block ${LEVEL_CLS[item.level]}`}>
              {item.level} · {item.source}
            </p>
            <p className="text-xs text-text-2 mt-2">
              {item.occurrence_count} ocorrência(s) · primeiro: {new Date(item.first_seen_at).toLocaleString('pt-BR')} · último: {new Date(item.last_seen_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <button onClick={onClose} className="text-text-2 hover:text-text-1 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">Mensagem</label>
            <p className="text-sm font-mono bg-navy-800 border border-navy-600 rounded p-3 break-words">
              {item.message}
            </p>
          </div>

          {item.stack && (
            <div>
              <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">Stack</label>
              <pre className="text-xs font-mono bg-navy-800 border border-navy-600 rounded p-3 overflow-auto max-h-72">
                {item.stack}
              </pre>
            </div>
          )}

          {item.url && (
            <div>
              <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">URL</label>
              <p className="text-xs text-brand-cyan break-all">{item.url}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-2 mb-1 uppercase">Fingerprint</label>
            <p className="text-xs font-mono text-text-2">{item.fingerprint}</p>
          </div>
        </div>

        {canWrite && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onResolve}
              className={`px-4 py-2 text-sm rounded-lg font-semibold ${
                item.resolved
                  ? 'border border-navy-600 text-text-2 hover:border-brand-cyan'
                  : 'bg-brand-cyan text-navy-900 hover:opacity-90'
              }`}
            >
              {item.resolved ? 'Reabrir' : '✓ Marcar resolvido'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
