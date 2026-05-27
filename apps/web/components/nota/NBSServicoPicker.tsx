'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

type Resultado = { codigo: string; descricao: string; ctrib_nac?: string }

type Props = {
  /** código NBS atualmente selecionado (somente dígitos) */
  value: string
  /** descrição do serviço selecionado, para exibir o chip */
  selectedDescricao?: string
  /** chamado quando o usuário escolhe um serviço */
  onSelect: (codigo: string, descricao: string) => void
  /** mensagem de erro de validação */
  error?: string
  /**
   * `true` = dropdown abre INLINE (empurra o conteúdo abaixo). Use em modais
   * com `overflow-y-auto` onde absolute estouraria a borda. Default = absolute.
   */
  inline?: boolean
}

// 8 dígitos → "01.01.01.10"
function formatNBS(codigo: string): string {
  const d = codigo.replace(/\D/g, '')
  return d.match(/.{1,2}/g)?.join('.') ?? codigo
}

const inputCls =
  'w-full bg-navy-900 border rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition'

// ── SessionStorage cache (TTL 10min) ──────────────────────────────────────
// Evita refetch repetido quando o usuário abre o modal várias vezes na mesma
// sessão. Chave inclui ignoreCnae+offset pra paginação ficar correta.

const CACHE_KEY_PREFIX = 'nbs-buscar:v2:'
const CACHE_TTL_MS = 10 * 60 * 1000

interface CachedResponse {
  results: Resultado[]
  total: number
  hasMore: boolean
  filtrado_por_cnpj: boolean
  cachedAt: number
}

function cacheGet(key: string): CachedResponse | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedResponse
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY_PREFIX + key)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function cacheSet(key: string, value: Omit<CachedResponse, 'cachedAt'>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      CACHE_KEY_PREFIX + key,
      JSON.stringify({ ...value, cachedAt: Date.now() }),
    )
  } catch {
    // Quota cheia — ignora silenciosamente
  }
}

export default function NBSServicoPicker({ value, selectedDescricao, onSelect, error, inline = false }: Props) {
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState<Resultado[]>([])
  const [loading, setLoading]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [open, setOpen]                 = useState(false)
  const [searched, setSearched]         = useState(false)
  const [filtradoPorCnpj, setFiltradoPorCnpj] = useState(false)
  // Estado de paginação (só usado no modo "Ver lista completa")
  const [mode, setMode] = useState<'search' | 'all'>('search')
  const [allParams, setAllParams] = useState<{ ignoreCnae: boolean }>({ ignoreCnae: false })
  const [total, setTotal]               = useState(0)
  const [hasMore, setHasMore]           = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const boxRef = useRef<HTMLDivElement>(null)

  // ── Fecha o dropdown ao clicar fora ───────────────────────────────────────
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // ── Helper de fetch com cache ─────────────────────────────────────────────
  const fetchPage = useCallback(async (
    params: URLSearchParams,
    cacheKey: string,
  ): Promise<{ results: Resultado[]; total: number; hasMore: boolean; filtrado_por_cnpj: boolean } | null> => {
    // Tenta cache primeiro
    const cached = cacheGet(cacheKey)
    if (cached) {
      return {
        results: cached.results,
        total: cached.total,
        hasMore: cached.hasMore,
        filtrado_por_cnpj: cached.filtrado_por_cnpj,
      }
    }
    try {
      const res = await fetch(`/api/nbs/buscar?${params}`)
      const body = await res.json().catch(() => null)
      if (!body) return null
      const payload = {
        results: body.results ?? [],
        total: body.total ?? 0,
        hasMore: Boolean(body.hasMore),
        filtrado_por_cnpj: Boolean(body.filtrado_por_cnpj),
      }
      cacheSet(cacheKey, payload)
      return payload
    } catch {
      return null
    }
  }, [])

  // ── Busca por texto (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (query.trim().length < 2) {
      // Se estávamos em modo "all", manter resultados. Senão limpa.
      if (mode === 'search') {
        setResults([])
        setSearched(false)
      }
      return
    }
    clearTimeout(debounceRef.current)
    setLoading(true)
    setMode('search')
    debounceRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ q: query })
      const cacheKey = `q=${query.toLowerCase()}`
      const data = await fetchPage(params, cacheKey)
      if (data) {
        setResults(data.results)
        setFiltradoPorCnpj(data.filtrado_por_cnpj)
        setOpen(true)
        setSearched(true)
        setHasMore(false)
        setTotal(data.total)
      } else {
        setResults([])
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, mode, fetchPage])

  // ── "Ver lista completa" (paginado) ──────────────────────────────────────
  async function listarTodos(opts: { ignoreCnae?: boolean } = {}) {
    setLoading(true)
    setOpen(true)
    setMode('all')
    setAllParams({ ignoreCnae: !!opts.ignoreCnae })
    const params = new URLSearchParams({ all: '1', offset: '0' })
    if (opts.ignoreCnae) params.set('ignoreCnae', '1')
    const cacheKey = `all=1&offset=0${opts.ignoreCnae ? '&ignoreCnae=1' : ''}`
    const data = await fetchPage(params, cacheKey)
    if (data) {
      setResults(data.results)
      setFiltradoPorCnpj(data.filtrado_por_cnpj)
      setSearched(true)
      setHasMore(data.hasMore)
      setTotal(data.total)
    } else {
      setResults([])
    }
    setLoading(false)
  }

  // ── "Carregar mais" (próxima página) ─────────────────────────────────────
  async function carregarMais() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const offset = results.length
    const params = new URLSearchParams({ all: '1', offset: String(offset) })
    if (allParams.ignoreCnae) params.set('ignoreCnae', '1')
    const cacheKey = `all=1&offset=${offset}${allParams.ignoreCnae ? '&ignoreCnae=1' : ''}`
    const data = await fetchPage(params, cacheKey)
    if (data) {
      // Dedup por codigo (paranoia contra duplicatas em ordering server-side)
      const existingIds = new Set(results.map(r => r.codigo))
      const novos = data.results.filter(r => !existingIds.has(r.codigo))
      setResults([...results, ...novos])
      setHasMore(data.hasMore)
    }
    setLoadingMore(false)
  }

  function pick(r: Resultado) {
    onSelect(r.codigo, r.descricao)
    setQuery('')
    setResults([])
    setOpen(false)
    setSearched(false)
    setMode('search')
    setHasMore(false)
  }

  // ── Memoiza a lista renderizada — evita re-render quando outros campos do
  // form mudam (parent re-renders mas o array de buttons só precisa montar
  // quando results muda)
  const renderedItems = useMemo(() => results.map((r) => (
    <button
      key={r.codigo}
      type="button"
      onClick={() => pick(r)}
      className="w-full text-left px-3 py-2.5 hover:bg-navy-700 transition border-b border-navy-600 last:border-0"
    >
      <p className="text-sm text-text-1">{r.descricao}</p>
      <p className="text-xs font-mono text-brand-cyan">NBS {formatNBS(r.codigo)}</p>
    </button>
  )), [results]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Estado: serviço já selecionado → mostra chip ──────────────────────────
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

  // Classes do container do dropdown:
  // - inline=true  → estática, empurra conteúdo abaixo (não estoura modal)
  // - inline=false → absoluta, overlay sobre o conteúdo abaixo
  const dropdownCls = inline
    ? 'mt-1 w-full rounded-xl border border-navy-600 bg-navy-900 shadow-xl max-h-60 overflow-y-auto'
    : 'absolute z-20 mt-1 w-full rounded-xl border border-navy-600 bg-navy-900 shadow-xl max-h-72 overflow-y-auto'

  return (
    <div className={inline ? '' : 'relative'} ref={boxRef}>
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
        <div className={dropdownCls}>
          {filtradoPorCnpj && !loading && results.length > 0 && (
            <p className="px-3 py-2 text-[11px] text-brand-cyan bg-brand-cyan/5 border-b border-navy-600 sticky top-0">
              ✓ Filtrado pelos CNAEs do seu CNPJ {total > results.length && `· ${results.length} de ${total}`}
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
                  Ver todos os serviços disponíveis para MEI →
                </button>
              )}
            </div>
          )}

          {!loading && renderedItems}

          {/* Carregar mais — só aparece no modo "Ver lista completa" e quando há mais */}
          {hasMore && !loading && (
            <button
              type="button"
              onClick={carregarMais}
              disabled={loadingMore}
              className="w-full text-center px-3 py-2.5 text-xs text-brand-cyan hover:bg-navy-700 transition border-t border-navy-600 disabled:opacity-50"
            >
              {loadingMore ? 'Carregando…' : `Carregar mais (${total - results.length} restantes)`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
