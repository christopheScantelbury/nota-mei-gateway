'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'
import { MunicipioAutocomplete } from './MunicipioAutocomplete'
import type { CepResult } from '@/app/api/cep/[cep]/route'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CepMunicipioInputProps {
  /** Controlled value — código IBGE de 7 dígitos (string) */
  value: string
  /** Chamado sempre que o município muda. uf pode ser undefined (seleção por nome). */
  onChange: (code: string, nome: string, uf?: string) => void
  error?: string
  disabled?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCEP(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Campo de município com CEP como input primário.
 *
 * Fluxo:
 * 1. Usuário digita o CEP (8 dígitos) → busca automática via /api/cep
 * 2. CEP encontrado → exibe card verde com município + UF detectados
 * 3. CEP não encontrado ou erro → exibe fallback de busca por nome (MunicipioAutocomplete)
 * 4. "Trocar" → volta ao CEP em branco
 *
 * A interface (value / onChange) é compatível com MunicipioAutocomplete para
 * substituição direta nos formulários existentes.
 */
export function CepMunicipioInput({
  value,
  onChange,
  error,
  disabled,
}: CepMunicipioInputProps) {
  const [cep, setCep]                     = React.useState('')
  const [resolved, setResolved]           = React.useState<CepResult | null>(null)
  const [resolvedByCep, setResolvedByCep] = React.useState(false)
  const [loading, setLoading]             = React.useState(false)
  const [cepError, setCepError]           = React.useState<string | null>(null)
  const [showFallback, setShowFallback]   = React.useState(false)

  // Se o pai zera o value externamente (ex: reset do form), limpa estado interno
  React.useEffect(() => {
    if (!value) {
      setCep('')
      setResolved(null)
      setResolvedByCep(false)
      setCepError(null)
      setShowFallback(false)
    }
  }, [value])

  async function lookupCep(digits: string) {
    setLoading(true)
    setCepError(null)
    try {
      const res = await fetch(`/api/cep/${digits}`)
      if (!res.ok) throw new Error('not_found')
      const data: CepResult = await res.json()
      setResolved(data)
      setResolvedByCep(true)
      setShowFallback(false)
      onChange(data.ibge, data.localidade, data.uf)
    } catch {
      setCepError('CEP não encontrado. Verifique o número ou busque pelo nome abaixo.')
      setShowFallback(true)
    } finally {
      setLoading(false)
    }
  }

  function handleCepChange(raw: string) {
    const formatted = formatCEP(raw)
    setCep(formatted)
    setResolved(null)
    setResolvedByCep(false)
    setCepError(null)
    onChange('', '')

    const digits = raw.replace(/\D/g, '')
    if (digits.length === 8) lookupCep(digits)
  }

  function reset() {
    setCep('')
    setResolved(null)
    setResolvedByCep(false)
    setCepError(null)
    setShowFallback(false)
    onChange('', '')
  }

  // Quando o usuário seleciona pelo nome (fallback), simula um "resolved por nome"
  function handleFallbackChange(code: string, nome: string) {
    if (code && nome) {
      setResolved({ localidade: nome, uf: '', ibge: code })
      setResolvedByCep(false)
    } else {
      setResolved(null)
    }
    onChange(code, nome)
  }

  const showCard = resolved !== null

  return (
    <div className="flex flex-col gap-2">
      {/* ── CEP input (escondido quando município já está confirmado) ─── */}
      {!showCard && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-text-2 uppercase tracking-wider">
            CEP
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              disabled={disabled}
              onChange={(e) => handleCepChange(e.target.value)}
              maxLength={9}
              autoComplete="postal-code"
              className={cn(
                'w-full rounded-lg border bg-navy-900 px-3 py-2 text-sm text-text-1 placeholder:text-text-2/50',
                'focus:outline-none focus:border-brand-cyan transition-colors pr-8',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                cepError || error ? 'border-nota-rejeitada' : 'border-navy-600',
              )}
            />
            {loading && (
              <span className="absolute right-2.5 pointer-events-none">
                <Spinner size="sm" color="muted" />
              </span>
            )}
          </div>

          {cepError && (
            <p className="text-xs text-nota-rejeitada">{cepError}</p>
          )}
          {!cepError && error && (
            <p className="text-xs text-nota-rejeitada">{error}</p>
          )}
        </div>
      )}

      {/* ── Card de município confirmado ─────────────────────────────── */}
      {showCard && (
        <div className="bg-nota-autorizada/10 border border-nota-autorizada/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-nota-autorizada text-lg" aria-hidden>
            📍
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-1 truncate">
              {resolved!.localidade}
              {resolved!.uf ? ` — ${resolved!.uf}` : ''}
            </p>
            <p className="text-xs text-text-2">
              {resolvedByCep
                ? `Detectado pelo CEP ${cep}`
                : 'Selecionado pelo nome'}
            </p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-xs text-text-2 hover:text-text-1 transition-colors"
            >
              Trocar
            </button>
          )}
        </div>
      )}

      {/* ── Fallback: toggle para busca por nome ─────────────────────── */}
      {!showCard && (
        <button
          type="button"
          onClick={() => setShowFallback((v) => !v)}
          className="self-start text-xs text-text-2 hover:text-brand-cyan transition-colors underline underline-offset-2"
        >
          {showFallback ? 'Ocultar busca por nome' : 'Não sei o CEP — buscar pelo nome'}
        </button>
      )}

      {/* ── Autocomplete por nome (fallback) ─────────────────────────── */}
      {showFallback && !showCard && (
        <MunicipioAutocomplete
          value={value}
          onChange={handleFallbackChange}
          disabled={disabled}
        />
      )}
    </div>
  )
}
