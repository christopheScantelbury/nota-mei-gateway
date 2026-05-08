'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'

type Sugestao = {
  codigo:    string
  descricao: string
  confianca: 'alta' | 'media' | 'baixa'
  motivo:    string
}

type Props = {
  /** descrição livre que o usuário já digitou (campo Discriminação) */
  descricao: string
  /** chamado quando o usuário escolhe um código sugerido */
  onSelect: (codigo: string) => void
}

const CONF_BADGE: Record<Sugestao['confianca'], string> = {
  alta:  'bg-nota-autorizada/15 text-nota-autorizada border-nota-autorizada/30',
  media: 'bg-nota-processando/15 text-nota-processando border-nota-processando/30',
  baixa: 'bg-text-2/15 text-text-2 border-text-2/30',
}

export default function SugestorNBS({ descricao, onSelect }: Props) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])

  async function buscarSugestoes() {
    setError(null)
    setSugestoes([])
    setLoading(true)
    setOpen(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const res = await fetch(`${API_BASE}/v1/ai/nbs/sugerir`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ descricao }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.message ?? `Erro ${res.status}`)
      }
      setSugestoes(body.sugestoes ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  function escolher(codigo: string) {
    onSelect(codigo)
    setOpen(false)
  }

  const podeBuscar = descricao.trim().length >= 5

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={buscarSugestoes}
        disabled={!podeBuscar || loading}
        className="self-start inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
        title={podeBuscar ? 'Sugerir código NBS pela descrição' : 'Preencha a descrição (mín. 5 caracteres)'}
      >
        <span aria-hidden="true">✨</span>
        {loading ? 'Buscando…' : 'Sugerir código com IA'}
      </button>

      {open && (
        <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-3">
          {error && (
            <p className="text-xs text-nota-rejeitada">⚠️ {error}</p>
          )}
          {!error && loading && (
            <p className="text-xs text-text-2">Analisando descrição…</p>
          )}
          {!error && !loading && sugestoes.length === 0 && (
            <p className="text-xs text-text-2">Nenhuma sugestão encontrada — tente reformular a descrição.</p>
          )}
          {!error && sugestoes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {sugestoes.map((s) => (
                <li key={s.codigo}>
                  <button
                    type="button"
                    onClick={() => escolher(s.codigo)}
                    className="w-full text-left rounded-lg border border-navy-600 bg-navy-700 p-3 hover:border-brand-blue/40 hover:bg-navy-700/80 transition group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-sm text-brand-blue font-semibold">{s.codigo}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold border rounded-full px-2 py-0.5 ${CONF_BADGE[s.confianca]}`}>
                        {s.confianca}
                      </span>
                    </div>
                    <p className="text-sm text-text-1 mb-1">{s.descricao}</p>
                    <p className="text-xs text-text-2 leading-snug">{s.motivo}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
