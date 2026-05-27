export const metadata = { title: 'Notas Fiscais' }

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import StatusBadge from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import type { NotaStatus } from '@/lib/types'
import { formatBRL } from '@/lib/format'

const PAGE_SIZE = 30

const VALID_STATUSES: NotaStatus[] = ['PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO_TEMPORARIO']

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

export default async function AdminNotasPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; q?: string }
}) {
  const supabase = createAdminClient()

  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const statusFilter = VALID_STATUSES.includes(searchParams.status as NotaStatus)
    ? (searchParams.status as NotaStatus)
    : undefined
  const q = searchParams.q?.trim()

  let query = supabase
    .from('notas_fiscais')
    .select(
      'id, mei_id, numero_rps, status, tomador_nome, tomador_doc, valor_servico, competencia, created_at, emitida_em, meis(razao_social)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (statusFilter) query = query.eq('status', statusFilter)
  if (q) {
    const isNumeric = /^\d+$/.test(q)
    query = isNumeric
      ? query.or(`tomador_nome.ilike.%${q}%,tomador_doc.ilike.%${q}%,numero_rps.eq.${q}`)
      : query.or(`tomador_nome.ilike.%${q}%,tomador_doc.ilike.%${q}%`)
  }

  const { data: notas, count } = await query.returns<{
    id: string
    mei_id: string
    numero_rps: number
    status: string
    tomador_nome: string | null
    tomador_doc: string | null
    valor_servico: number | null
    competencia: string | null
    created_at: string
    emitida_em: string | null
    meis: { razao_social: string } | null
  }[]>()

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function buildParams(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (q) p.set('q', q)
    Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return p.toString() ? `?${p.toString()}` : ''
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-text-1">Notas Fiscais</h1>
          <p className="text-text-2 mt-1 text-sm">{count ?? 0} notas no total</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex gap-3 mb-6 flex-wrap">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar tomador, doc ou Nº RPS…"
          className="flex-1 min-w-[200px] bg-navy-700 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan"
        />
        {/* Native select — server component + form GET. Styled com appearance-none
            + chevron embutido pra ficar visualmente alinhado ao restante. */}
        <div className="relative">
          <select
            name="status"
            defaultValue={statusFilter ?? ''}
            className="appearance-none bg-navy-700 border border-navy-600 rounded-lg pl-3 pr-9 py-2 text-sm text-text-1 focus:outline-none focus:border-brand-cyan cursor-pointer"
          >
            <option value="">Todos os status</option>
            {VALID_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <svg
            width="14" height="14" viewBox="0 0 16 16"
            className="text-text-2 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <Button type="submit" variant="primary" size="sm">
          Filtrar
        </Button>
        {(statusFilter || q) && (
          <Link
            href="/admin/notas"
            className="px-4 py-2 text-sm border border-navy-600 text-text-2 hover:text-text-1 rounded-lg transition"
          >
            Limpar
          </Link>
        )}
      </form>

      {(notas ?? []).length === 0 ? (
        <div className="flex items-center justify-center py-24 rounded-xl border border-navy-600 border-dashed">
          <p className="text-text-2 text-sm">Nenhuma nota encontrada.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-navy-600 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy-700 border-b border-navy-600 text-xs text-text-2 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Nº RPS</th>
                    <th className="px-4 py-3 text-left">MEI</th>
                    <th className="px-4 py-3 text-left">Tomador</th>
                    <th className="px-4 py-3 text-left">Valor</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Emitida em</th>
                  </tr>
                </thead>
                <tbody>
                  {(notas ?? []).map((n) => (
                    <tr key={n.id} className="border-b border-navy-600 last:border-0 hover:bg-navy-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-brand-cyan">#{n.numero_rps}</td>
                      <td className="px-4 py-3 text-text-2 max-w-[140px] truncate">
                        {n.meis?.razao_social ?? n.mei_id.slice(0, 8) + '…'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[160px]">{n.tomador_nome ?? '—'}</div>
                        {n.tomador_doc && <div className="text-xs text-text-2">{n.tomador_doc}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono">{formatBRL(n.valor_servico)}</td>
                      <td className="px-4 py-3"><StatusBadge status={n.status as NotaStatus} /></td>
                      <td className="px-4 py-3 text-text-2 whitespace-nowrap">
                        {formatDate(n.emitida_em ?? n.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-text-2">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/notas${buildParams({ page: String(page - 1) })}`}
                    className="px-3 py-1 rounded border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/notas${buildParams({ page: String(page + 1) })}`}
                    className="px-3 py-1 rounded border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan transition"
                  >
                    Próxima →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
