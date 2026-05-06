'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { normalize, toCode } from '@/lib/municipio'
import { Spinner } from './Spinner'

// ── Types ─────────────────────────────────────────────────────────────────────

// O proxy /api/municipios já transforma a resposta do IBGE server-side e
// devolve apenas { id, nome, uf } — o cliente nunca precisa navegar a cadeia
// aninhada microrregiao.mesorregiao.UF.sigla, que é undefined em territórios
// especiais e causava TypeError abortando o map() inteiro.
interface Municipio {
  id: number
  nome: string
  uf: string
}

export interface MunicipioAutocompleteProps {
  /** Controlled value — the 7-digit IBGE code as a string (zero-padded) */
  value: string
  onChange: (code: string, nome: string) => void
  error?: string
  disabled?: boolean
}

// ── Module-level cache (loaded once per browser session) ──────────────────────

let cachedMunicipios: Municipio[] | null = null
let fetchPromise: Promise<Municipio[]> | null = null

async function fetchMunicipios(): Promise<Municipio[]> {
  if (cachedMunicipios) return cachedMunicipios
  if (fetchPromise) return fetchPromise

  // O proxy /api/municipios transforma server-side e devolve { id, nome, uf }[].
  // O cliente nunca toca na cadeia aninhada do IBGE — sem risco de TypeError.
  fetchPromise = fetch('/api/municipios')
    .then((res) => {
      if (!res.ok) throw new Error(`Falha ao carregar municípios (HTTP ${res.status})`)
      return res.json()
    })
    .then((raw: unknown) => {
      // Defesa extra: garante que é um array e descarta entradas incompletas.
      const data: Municipio[] = Array.isArray(raw) ? (raw as Municipio[]) : []
      cachedMunicipios = data.filter((m) => m.id && m.nome && m.uf)

      if (cachedMunicipios.length === 0) {
        throw new Error('Lista de municípios vazia ou formato inesperado')
      }
      return cachedMunicipios
    })
    .catch((err) => {
      // Reset so the next attempt can retry instead of reusing the rejected promise
      console.error('[MunicipioAutocomplete] erro ao carregar municípios:', err)
      fetchPromise = null
      throw err
    })

  return fetchPromise
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MunicipioAutocomplete({
  value,
  onChange,
  error,
  disabled,
}: MunicipioAutocompleteProps) {
  const [query, setQuery]             = React.useState('')
  const [suggestions, setSuggestions] = React.useState<Municipio[]>([])
  const [open, setOpen]               = React.useState(false)
  const [activeIdx, setActiveIdx]     = React.useState(-1)
  const [loading, setLoading]         = React.useState(false)
  const [fetchError, setFetchError]   = React.useState(false)
  const [allMunicipios, setAll]       = React.useState<Municipio[] | null>(null)
  const [displayName, setDisplayName] = React.useState('')

  const inputRef    = React.useRef<HTMLInputElement>(null)
  const listRef     = React.useRef<HTMLUListElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const inputId     = React.useId()
  const listId      = `${inputId}-list`

  // Resolve display name for an initial/external value change
  React.useEffect(() => {
    if (!value) {
      setDisplayName('')
      return
    }
    if (allMunicipios) {
      const m = allMunicipios.find((m) => toCode(m.id) === value)
      if (m) setDisplayName(`${m.nome} — ${m.uf}`)
    }
  }, [value, allMunicipios])

  // Pre-load list so it's ready when the user focuses
  async function ensureLoaded(): Promise<Municipio[] | null> {
    if (allMunicipios) return allMunicipios
    setLoading(true)
    setFetchError(false)
    try {
      const list = await fetchMunicipios()
      setAll(list)
      return list
    } catch {
      setFetchError(true)
      return null
    } finally {
      setLoading(false)
    }
  }

  function filterList(term: string, list: Municipio[]) {
    const q = normalize(term)
    const results = list
      .filter((m) => normalize(m.nome).startsWith(q) || normalize(m.uf) === q)
      .concat(
        list.filter(
          (m) =>
            !normalize(m.nome).startsWith(q) &&
            normalize(m.nome).includes(q),
        ),
      )
      // deduplicate (concat may add duplicates when both predicates match)
      .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
      .slice(0, 8)
    setSuggestions(results)
    setActiveIdx(-1)
    setOpen(results.length > 0)
  }

  async function handleInputChange(raw: string) {
    setQuery(raw)
    setDisplayName(raw)

    if (raw.length < 2) {
      clearTimeout(debounceRef.current)
      setSuggestions([])
      setOpen(false)
      return
    }

    const list = allMunicipios ?? (await ensureLoaded())
    if (!list) return

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => filterList(raw, list), 300)
  }

  function select(m: Municipio) {
    const label = `${m.nome} — ${m.uf}`
    setDisplayName(label)
    setQuery(label)
    setSuggestions([])
    setOpen(false)
    setActiveIdx(-1)
    onChange(toCode(m.id), m.nome)
    inputRef.current?.blur()
  }

  function handleBlur(e: React.FocusEvent) {
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open && suggestions.length > 0) { setOpen(true); return }
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && activeIdx >= 0) {
      e.preventDefault()
      select(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const activeDescendant =
    open && activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold text-text-2 uppercase tracking-wider">
        Município
      </label>

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="Digite o nome do município…"
          value={displayName}
          disabled={disabled}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (!allMunicipios) ensureLoaded() }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeDescendant}
          className={cn(
            'w-full rounded-lg border bg-navy-900 px-3 py-2 text-sm text-text-1 placeholder:text-text-2/50',
            'focus:outline-none focus:border-brand-cyan transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-nota-rejeitada' : 'border-navy-600',
            'pr-8',
          )}
        />
        {loading && (
          <span className="absolute right-2.5 pointer-events-none">
            <Spinner size="sm" color="muted" />
          </span>
        )}
      </div>

      {error && <p className="text-xs text-nota-rejeitada">{error}</p>}

      {/* Fallback: if fetch failed, allow direct IBGE code entry */}
      {fetchError && (
        <div className="space-y-1.5">
          <p className="text-xs text-nota-rejeitada">
            Não foi possível carregar os municípios via IBGE. Digite o código IBGE manualmente (7 dígitos).
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ex.: 3550308 (São Paulo)"
            maxLength={7}
            value={value}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 7)
              if (v.length === 7) {
                onChange(v, `Código IBGE: ${v}`)
              } else {
                onChange(v, '')
              }
            }}
            className={cn(
              'w-full rounded-lg border bg-navy-900 px-3 py-2 text-sm text-text-1 placeholder:text-text-2/50',
              'focus:outline-none focus:border-brand-cyan transition-colors',
              value.length === 7 ? 'border-nota-autorizada' : 'border-navy-600',
            )}
          />
          {value.length === 7 && (
            <p className="text-xs text-nota-autorizada">✓ Código IBGE registrado: {value}</p>
          )}
        </div>
      )}

      {/* Hidden input carries the IBGE code */}
      <input type="hidden" name="municipio_ibge" value={value} />

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Municípios"
          className={cn(
            'absolute left-0 right-0 top-[calc(100%+4px)] z-50',
            'max-h-60 overflow-y-auto',
            'rounded-lg border border-navy-600 bg-navy-700 shadow-xl',
            'divide-y divide-navy-600/50',
          )}
        >
          {suggestions.map((m, idx) => {
            const isActive  = idx === activeIdx
            const isSelected = toCode(m.id) === value
            return (
              <li
                key={m.id}
                id={`${listId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2',
                    'focus:outline-none transition-colors',
                    isActive || isSelected
                      ? 'bg-navy-600 text-brand-cyan'
                      : 'hover:bg-navy-600 text-text-1',
                  )}
                  onMouseDown={(e) => { e.preventDefault(); select(m) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <span className="truncate">
                    {m.nome} — {m.uf}
                  </span>
                  <span className="shrink-0 text-xs text-text-2 font-mono">
                    {toCode(m.id)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
