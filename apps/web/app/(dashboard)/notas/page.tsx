export const metadata = { title: 'Notas Fiscais' }

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import NotasFilterBar from '@/components/dashboard/NotasFilterBar'
import ExportCSVButton from '@/components/dashboard/ExportCSVButton'
import ISSBadge from '@/components/nota/ISSBadge'
import SubstituicaoDeadline from '@/components/nota/SubstituicaoDeadline'
import type { Nota, NotaStatus } from '@/lib/types'

const PAGE_SIZE = 20

const VALID_STATUSES: NotaStatus[] = ['PROCESSANDO', 'AUTORIZADA', 'REJEITADA', 'CANCELADA', 'ERRO_TEMPORARIO']

const SORT_COLUMNS: Record<string, string> = {
  data:    'created_at',
  tomador: 'tomador_nome',
  valor:   'valor_servico',
  status:  'status',
}

function formatBRL(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function buildParams(base: Record<string, string | undefined>, overrides: Record<string, string>): string {
  const p = new URLSearchParams()
  Object.entries({ ...base, ...overrides }).forEach(([k, v]) => {
    if (v) p.set(k, v)
  })
  return p.toString() ? `?${p.toString()}` : ''
}

interface SortLinkProps {
  col: string
  label: string
  currentSort?: string
  currentOrder?: string
  base: Record<string, string | undefined>
}

function SortLink({ col, label, currentSort, currentOrder, base }: SortLinkProps) {
  const isActive = currentSort === col
  const nextOrder = isActive && currentOrder === 'asc' ? 'desc' : 'asc'
  const href = `/notas${buildParams(base, { sort: col, order: nextOrder, page: '1' })}`
  return (
    <Link href={href} className="flex items-center gap-1 hover:text-brand-cyan transition group">
      {label}
      <span className={`text-xs ${isActive ? 'text-brand-cyan' : 'text-navy-600 group-hover:text-brand-cyan'}`}>
        {isActive ? (currentOrder === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </Link>
  )
}

export default async function NotasPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string; q?: string; sort?: string; order?: string; competencia?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const statusFilter = VALID_STATUSES.includes(searchParams.status as NotaStatus)
    ? (searchParams.status as NotaStatus)
    : undefined
  const q           = searchParams.q?.trim()
  const sortKey     = searchParams.sort && SORT_COLUMNS[searchParams.sort] ? searchParams.sort : 'data'
  const sortCol     = SORT_COLUMNS[sortKey]
  const ascending   = searchParams.order === 'asc'
  const competencia = searchParams.competencia

  let query = supabase
    .from('notas_fiscais')
    .select('*', { count: 'exact' })
    .eq('mei_id', user.id)

  if (statusFilter)  query = query.eq('status', statusFilter)
  if (competencia)   query = query.eq('competencia', competencia)
  if (q) {
    const isNumeric = /^\d+$/.test(q)
    if (isNumeric) {
      query = query.or(`tomador_nome.ilike.%${q}%,tomador_doc.ilike.%${q}%,numero_rps.eq.${q}`)
    } else {
      query = query.or(`tomador_nome.ilike.%${q}%,tomador_doc.ilike.%${q}%`)
    }
  }

  query = query.order(sortCol, { ascending }).range(from, to)

  const { data: notas, count } = await query.returns<Nota[]>()

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
  const rows = notas ?? []

  // Base params for pagination links (preserve all filters)
  const filterBase: Record<string, string | undefined> = {
    status: statusFilter,
    q: q || undefined,
    sort: sortKey !== 'data' ? sortKey : undefined,
    order: searchParams.order,
    competencia,
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Notas Fiscais</h1>
          <p className="text-text-2 mt-1 text-sm">
            {count ?? 0} nota{count !== 1 ? 's' : ''} encontrada{count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportCSVButton notas={rows} />
          <Link
            href="/notas/nova"
            className="text-sm bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            + Emitir nova nota
          </Link>
        </div>
      </div>

      <NotasFilterBar
        currentStatus={statusFilter}
        currentQ={q}
        currentCompetencia={competencia}
      />

      {rows.length === 0 ? (
        <EmptyState hasFilters={!!(statusFilter || q || competencia)} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-navy-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-700 border-b border-navy-600">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    Nº RPS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    <SortLink col="tomador" label="Tomador" currentSort={sortKey} currentOrder={searchParams.order} base={filterBase} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    <SortLink col="valor" label="Valor" currentSort={sortKey} currentOrder={searchParams.order} base={filterBase} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    Competência
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    <SortLink col="status" label="Status" currentSort={sortKey} currentOrder={searchParams.order} base={filterBase} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">
                    <SortLink col="data" label="Emitida em" currentSort={sortKey} currentOrder={searchParams.order} base={filterBase} />
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-navy-600 last:border-0 hover:bg-navy-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-brand-cyan">#{n.numero_rps}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[180px]">{n.tomador_nome ?? '—'}</div>
                      {n.tomador_doc && <div className="text-xs text-text-2">{n.tomador_doc}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatBRL(n.valor_servico)}</td>
                    <td className="px-4 py-3 text-text-2">{n.competencia ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={n.status} />
                        {/* ME-42: ISS recolhimento badge (compact) */}
                        <ISSBadge regime={n.regime_tributario} issRetido={n.iss_retido} compact />
                        {/* ME-43: substitution deadline (compact) */}
                        <SubstituicaoDeadline
                          status={n.status}
                          emitidaEm={n.emitida_em}
                          regime={n.regime_tributario}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-2">{formatDate(n.emitida_em ?? n.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/notas/${n.id}`} className="text-xs text-brand-cyan hover:underline">
                        Detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-text-2">
              <span>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/notas${buildParams(filterBase, { page: String(page - 1) })}`}
                    className="px-3 py-1 rounded border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/notas${buildParams(filterBase, { page: String(page + 1) })}`}
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

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-navy-600 border-dashed">
      <span className="text-5xl mb-4">🧾</span>
      <h3 className="font-display font-bold text-xl mb-2">
        {hasFilters ? 'Nenhuma nota encontrada' : 'Nenhuma nota emitida'}
      </h3>
      <p className="text-text-2 text-sm max-w-xs">
        {hasFilters
          ? 'Tente ajustar os filtros ou limpar a busca.'
          : 'Emita sua primeira NFS-e pelo dashboard ou via API.'}
      </p>
      {!hasFilters && (
        <Link
          href="/notas/nova"
          className="mt-6 text-sm bg-brand-cyan text-navy-900 font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
        >
          + Emitir nova nota
        </Link>
      )}
    </div>
  )
}
