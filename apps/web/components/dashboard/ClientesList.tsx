'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { hasFeature } from '@/lib/plans'
import { formatBRL, formatCNPJ, formatCPF } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import type { Cliente } from '@/lib/types-cliente'

function formatDocumento(c: Pick<Cliente, 'tipo' | 'documento'>): string {
  return c.tipo === 'PJ' ? formatCNPJ(c.documento) : formatCPF(c.documento)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

interface Props {
  initial:        Cliente[]
  total:          number
  planName:       string
  allTags:        string[]
  searchQ:        string
  searchTag:      string
  showArquivados: boolean
}

export default function ClientesList({
  initial,
  total,
  planName,
  allTags,
  searchQ,
  searchTag,
  showArquivados,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [q, setQ]   = useState(searchQ)
  const [tag, setTag] = useState(searchTag)
  const [arq, setArq] = useState(showArquivados)
  const [, startTransition] = useTransition()

  const canCrud = hasFeature(planName, 'clientesCrud')

  function applyFilters(next: { q?: string; tag?: string; arquivados?: boolean } = {}) {
    const params = new URLSearchParams()
    const finalQ   = next.q ?? q
    const finalTag = next.tag ?? tag
    const finalArq = next.arquivados ?? arq
    if (finalQ)   params.set('q', finalQ)
    if (finalTag) params.set('tag', finalTag)
    if (finalArq) params.set('arquivados', 'true')
    startTransition(() => {
      router.push(`${pathname}${params.toString() ? `?${params}` : ''}`)
    })
  }

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Clientes</h1>
          <p className="text-text-2 mt-1 text-sm">
            {total} cliente{total !== 1 ? 's' : ''} {arq ? 'arquivado' : 'ativo'}{total !== 1 ? 's' : ''}
          </p>
        </div>
        {canCrud && (
          <Link
            href="/clientes/novo"
            className="text-sm bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition whitespace-nowrap"
          >
            + Novo cliente
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form
          onSubmit={(e) => { e.preventDefault(); applyFilters() }}
          className="flex-1 flex gap-2"
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou CNPJ/CPF…"
            className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan"
          />
          <Button type="submit" variant="secondary" size="sm">Buscar</Button>
        </form>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => { setTag(e.target.value); applyFilters({ tag: e.target.value }) }}
            className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm text-text-1"
          >
            <option value="">Todas tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <label className="inline-flex items-center gap-2 text-xs text-text-2 select-none">
          <input
            type="checkbox"
            checked={arq}
            onChange={(e) => { setArq(e.target.checked); applyFilters({ arquivados: e.target.checked }) }}
            className="accent-brand-cyan"
          />
          Arquivados
        </label>
      </div>

      {/* Empty state */}
      {initial.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-navy-600 border-dashed">
          <span className="text-5xl mb-4">👥</span>
          <h3 className="font-display font-bold text-xl mb-2">
            {q || tag ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
          </h3>
          <p className="text-text-2 text-sm max-w-xs">
            {q || tag
              ? 'Tente ajustar os filtros.'
              : 'Seus clientes aparecem aqui automaticamente quando você emite a primeira nota para eles.'}
          </p>
          {canCrud && !q && !tag && (
            <Link
              href="/clientes/novo"
              className="mt-6 text-sm bg-brand-cyan text-navy-900 font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
            >
              + Cadastrar primeiro cliente
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile: cards (< sm) ── */}
          <div className="sm:hidden space-y-3">
            {initial.map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="block rounded-xl border border-navy-600 bg-navy-700/50 p-4 hover:border-brand-cyan transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.razao_social}</p>
                    <p className="text-xs text-text-2 mt-0.5">{formatDocumento(c)}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                    c.tipo === 'PJ'
                      ? 'border-brand-cyan/40 text-brand-cyan bg-brand-cyan/10'
                      : 'border-nota-upgrade/40 text-nota-upgrade bg-nota-upgrade/10'
                  }`}>
                    {c.tipo}
                  </span>
                </div>
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] text-text-2 bg-navy-600 rounded-full px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-text-2">
                  <span>{c.total_notas} nota{c.total_notas !== 1 ? 's' : ''} · {formatBRL(c.total_emitido_brl)}</span>
                  <span>{formatDate(c.ultima_emissao_em)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Desktop: table (≥ sm) ── */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-navy-600">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-700 border-b border-navy-600">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Documento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Notas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Total faturado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase tracking-wider">Última emissão</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {initial.map((c) => (
                  <tr key={c.id} className="border-b border-navy-600 last:border-0 hover:bg-navy-700/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-[220px]">{c.razao_social}</div>
                      {c.nome_fantasia && <div className="text-xs text-text-2 truncate max-w-[220px]">{c.nome_fantasia}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-2">{formatDocumento(c)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] text-text-2 bg-navy-600 rounded-full px-2 py-0.5">{t}</span>
                        ))}
                        {c.tags.length > 3 && <span className="text-[10px] text-text-2">+{c.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono">{c.total_notas}</td>
                    <td className="px-4 py-3 font-mono">{formatBRL(c.total_emitido_brl)}</td>
                    <td className="px-4 py-3 text-text-2 text-xs">{formatDate(c.ultima_emissao_em)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/clientes/${c.id}`} className="text-xs text-brand-cyan hover:underline">
                        Detalhes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
