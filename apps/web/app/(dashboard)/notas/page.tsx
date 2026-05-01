import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import type { Nota } from '@/lib/types'

const PAGE_SIZE = 20

function formatBRL(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export default async function NotasPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/')

  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: notas, count } = await supabase
    .from('notas_fiscais')
    .select('*', { count: 'exact' })
    .eq('mei_id', session.user.id)
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<Nota[]>()

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)
  const rows = notas ?? []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Notas Fiscais</h1>
          <p className="text-text-2 mt-1 text-sm">
            {count ?? 0} nota{count !== 1 ? 's' : ''} emitida{count !== 1 ? 's' : ''}
          </p>
        </div>
        <a
          href="https://docs.notameigateway.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          + Emitir via API
        </a>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-navy-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-700 border-b border-navy-600">
                  {['Nº RPS', 'Tomador', 'Valor', 'Competência', 'Status', 'Emitida em', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
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
                      <div className="font-medium truncate max-w-[180px]">
                        {n.tomador_nome ?? '—'}
                      </div>
                      {n.tomador_doc && (
                        <div className="text-xs text-text-2">{n.tomador_doc}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">{formatBRL(n.valor_servico)}</td>
                    <td className="px-4 py-3 text-text-2">{n.competencia ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="px-4 py-3 text-text-2">
                      {formatDate(n.emitida_em ?? n.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/notas/${n.id}`}
                        className="text-xs text-brand-cyan hover:underline"
                      >
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
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/notas?page=${page - 1}`}
                    className="px-3 py-1 rounded border border-navy-600 hover:border-brand-cyan hover:text-brand-cyan transition"
                  >
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/notas?page=${page + 1}`}
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-navy-600 border-dashed">
      <span className="text-5xl mb-4">🧾</span>
      <h3 className="font-display font-bold text-xl mb-2">Nenhuma nota emitida</h3>
      <p className="text-text-2 text-sm max-w-xs">
        Use a API para emitir sua primeira NFS-e. Consulte a documentação para começar.
      </p>
      <a
        href="https://docs.notameigateway.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 text-sm text-brand-cyan hover:underline"
      >
        Ver documentação →
      </a>
    </div>
  )
}
