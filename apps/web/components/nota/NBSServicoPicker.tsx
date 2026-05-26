'use client'

import { useState, useEffect, useRef } from 'react'

type Resultado = { codigo: string; descricao: string }

type Props = {
  /** código NBS atualmente selecionado (somente dígitos) */
  value: string
  /** descrição do serviço selecionado, para exibir o chip */
  selectedDescricao?: string
  /** chamado quando o usuário escolhe um serviço */
  onSelect: (codigo: string, descricao: string) => void
  /** mensagem de erro de validação */
  error?: string
}

// 8 dígitos → "01.01.01.10"
function formatNBS(codigo: string): string {
  const d = codigo.replace(/\D/g, '')
  return d.match(/.{1,2}/g)?.join('.') ?? codigo
}

const inputCls =
  'w-full bg-navy-900 border rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition'

export default function NBSServicoPicker({ value, selectedDescricao, onSelect, error }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Resultado[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [searched, setSearched] = useState(false)
  const [filtradoPorCnpj, setFiltradoPorCnpj] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const boxRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Busca com debounce.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nbs/buscar?q=${encodeURIComponent(query)}`)
        const body = await res.json().catch(() => ({ results: [] }))
        setResults(body.results ?? [])
        setFiltradoPorCnpj(Boolean(body.filtrado_por_cnpj))
        setOpen(true)
        setSearched(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function pick(r: Resultado) {
    onSelect(r.codigo, r.descricao)
    setQuery('')
    setResults([])
    setOpen(false)
    setSearched(false)
  }

  async function listarTodos(opts: { ignoreCnae?: boolean } = {}) {
    setLoading(true)
    setOpen(true)
    try {
      const params = new URLSearchParams({ all: '1' })
      if (opts.ignoreCnae) params.set('ignoreCnae', '1')
      const res = await fetch(`/api/nbs/buscar?${params}`)
      const body = await res.json().catch(() => ({ results: [] }))
      setResults(body.results ?? [])
      setFiltradoPorCnpj(Boolean(body.filtrado_por_cnpj))
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Estado: serviço já selecionado → mostra chip.
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-nota-autorizada/30 bg-nota-autorizada/5 px-3 py-2.5">
        <div className="min-w-0">
          {selectedDescricao && <p className="text-sm text-text-1 truncate">{selectedDescricao}</p>}
          <p className="text-xs font-mono text-brand-cyan">NBS {formatNBS(value)}</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect('', '')}
          className="shrink-0 text-xs text-text-2 hover:text-brand-cyan transition"
        >
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        className={[inputCls, error ? 'border-nota-rejeitada' : 'border-navy-600'].join(' ')}
        placeholder="Busque pelo nome do serviço — ex: desenvolvimento de software"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        autoComplete="off"
      />

      {/* CTA pra listar todos os disponíveis — útil quando o user não sabe digitar */}
      <button
        type="button"
        onClick={() => listarTodos()}
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand-cyan hover:underline transition"
      >
        📋 Ver lista completa de serviços disponíveis
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-navy-600 bg-navy-900 shadow-xl max-h-72 overflow-y-auto">
          {filtradoPorCnpj && !loading && results.length > 0 && (
            <p className="px-3 py-2 text-[11px] text-brand-cyan bg-brand-cyan/5 border-b border-navy-600">
              ✓ Filtrado pelos CNAEs do seu CNPJ
            </p>
          )}
          {loading && <p className="px-3 py-2.5 text-xs text-text-2">Buscando serviços…</p>}
          {!loading && searched && results.length === 0 && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-xs text-text-2">
                {filtradoPorCnpj
                  ? 'Nenhum serviço habilitado para os CNAEs do seu CNPJ com esse termo.'
                  : 'Nenhum serviço encontrado com esse termo.'}
              </p>
              {filtradoPorCnpj && (
                <button
                  type="button"
                  onClick={() => listarTodos({ ignoreCnae: true })}
                  className="text-xs text-brand-cyan hover:underline"
                >
                  Ver todos os serviços disponíveis para {/* categoria já vem do contexto */}MEI →
                </button>
              )}
            </div>
          )}
          {!loading &&
            results.map((r) => (
              <button
                key={r.codigo}
                type="button"
                onClick={() => pick(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-navy-700 transition border-b border-navy-600 last:border-0"
              >
                <p className="text-sm text-text-1">{r.descricao}</p>
                <p className="text-xs font-mono text-brand-cyan">NBS {formatNBS(r.codigo)}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
