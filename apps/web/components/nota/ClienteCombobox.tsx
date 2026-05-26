'use client'

import { useState, useEffect, useRef } from 'react'
import { formatCNPJ, formatCPF } from '@/lib/format'
import type { ClienteAutocomplete } from '@/lib/types-cliente'

interface Props {
  onSelect: (c: ClienteAutocomplete) => void
  /** Mostrado em vez do combobox quando o plano não tem clientesRead */
  locked?: boolean
}

function formatDoc(c: Pick<ClienteAutocomplete, 'tipo' | 'documento'>): string {
  return c.tipo === 'PJ' ? formatCNPJ(c.documento) : formatCPF(c.documento)
}

export default function ClienteCombobox({ onSelect, locked }: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<ClienteAutocomplete[]>([])
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Carrega lista inicial (top 10 recentes) ao abrir pela primeira vez
  useEffect(() => {
    if (locked) return
    let aborted = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/clientes/autocomplete?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error('fail')
        const data = await res.json() as { clientes: ClienteAutocomplete[] }
        if (!aborted) setResults(data.clientes ?? [])
      } catch {
        if (!aborted) setResults([])
      } finally {
        if (!aborted) setLoading(false)
      }
    }, 200) // debounce
    return () => { aborted = true; clearTimeout(t) }
  }, [query, locked])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (locked) {
    return (
      <div className="rounded-xl border border-navy-600 bg-navy-700/30 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-text-2">
          <span>🔒</span>
          <span>
            Cadastre clientes para preencher rapidamente. Disponível a partir do{' '}
            <span className="text-nota-upgrade font-semibold">Starter</span>.
          </span>
        </div>
        <a href="/billing" className="text-xs font-semibold text-nota-upgrade hover:underline shrink-0">
          Fazer upgrade →
        </a>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-sm font-medium text-text-1 mb-1 block">
        Cliente cadastrado <span className="text-text-2 font-normal">(opcional)</span>
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar por nome ou CNPJ/CPF…"
        className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full"
      />
      <p className="text-xs text-text-2 mt-1">
        ou preencha os dados manualmente abaixo
      </p>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-lg border border-navy-600 bg-navy-700 shadow-lg">
          {loading && (
            <div className="px-4 py-3 text-xs text-text-2">Buscando…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-text-2">
              {query
                ? 'Nenhum cliente encontrado.'
                : 'Nenhum cliente cadastrado ainda — emita uma nota pra começar.'}
            </div>
          )}
          {!loading && results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c)
                setQuery('')
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-navy-600 transition border-b border-navy-600/50 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-1 truncate">{c.razao_social}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${
                  c.tipo === 'PJ'
                    ? 'border-brand-cyan/40 text-brand-cyan'
                    : 'border-nota-upgrade/40 text-nota-upgrade'
                }`}>
                  {c.tipo}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-xs text-text-2 font-mono">{formatDoc(c)}</span>
                <span className="text-xs text-text-2">{c.total_notas} nota{c.total_notas !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
