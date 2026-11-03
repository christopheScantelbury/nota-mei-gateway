'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'

export interface Entrada {
  id: string
  titulo: string
  conteudo: string
  categoria: Categoria
  ativo: boolean
  ordem: number
  updated_at: string
}

type Categoria = 'correcao' | 'limitacao' | 'instabilidade' | 'procedimento' | 'faq'

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: 'correcao',      label: 'Correção publicada' },
  { value: 'instabilidade', label: 'Instabilidade' },
  { value: 'limitacao',     label: 'Limitação' },
  { value: 'procedimento',  label: 'Procedimento' },
  { value: 'faq',           label: 'Dúvida frequente' },
]

const VAZIA = { titulo: '', conteudo: '', categoria: 'correcao' as Categoria, ordem: 0 }

export default function KnowledgeEditor({ entradas, podeEscrever }: { entradas: Entrada[]; podeEscrever: boolean }) {
  const router = useRouter()
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const [form, setForm] = useState(VAZIA)
  const [pending, startTransition] = useTransition()

  function abrir(e?: Entrada) {
    setEditando(e ? e.id : 'nova')
    setForm(e ? { titulo: e.titulo, conteudo: e.conteudo, categoria: e.categoria, ordem: e.ordem } : VAZIA)
  }

  async function salvar() {
    const nova = editando === 'nova'
    const res = await fetch(`/admin/api/suporte/conhecimento${nova ? '' : `?id=${editando}`}`, {
      method: nova ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return notify.error('Não foi possível salvar', d.message ?? `Erro ${res.status}`)
    notify.success('Salvo', 'A IA já usa esta versão na próxima resposta.', { skipScroll: true })
    setEditando(null)
    startTransition(() => router.refresh())
  }

  async function alternar(e: Entrada) {
    const res = await fetch(`/admin/api/suporte/conhecimento?id=${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !e.ativo }),
    })
    if (!res.ok) return notify.error('Não foi possível atualizar')
    startTransition(() => router.refresh())
  }

  const formulario = (
    <div className="rounded-xl border border-brand-cyan/40 bg-navy-700 p-4 space-y-3">
      <input
        value={form.titulo}
        onChange={(e) => setForm({ ...form, titulo: e.target.value })}
        maxLength={200}
        placeholder="Título — ex.: Rejeição E0714 corrigida em 03/11/2026"
        className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setForm({ ...form, categoria: c.value })}
            className={`px-3 py-1 rounded-full text-xs border ${form.categoria === c.value ? 'border-brand-cyan bg-brand-cyan/10 text-text-1' : 'border-navy-600 text-text-2'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        value={form.conteudo}
        onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
        rows={7}
        maxLength={6000}
        placeholder={'O que mudou, impacto para o cliente e como orientar.\nEx.: "Como orientar: o cliente pode emitir de novo..."'}
        className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-text-2 flex items-center gap-2">
          Ordem
          <input
            type="number"
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
            className="w-20 bg-navy-900 border border-navy-600 rounded px-2 py-1 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button onClick={() => setEditando(null)} className="px-3 py-2 text-sm text-text-2">Cancelar</button>
          <button onClick={() => void salvar()} disabled={pending || !form.titulo.trim() || !form.conteudo.trim()} className="px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 font-semibold text-sm disabled:opacity-50">
            Salvar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {podeEscrever && editando !== 'nova' && (
        <button onClick={() => abrir()} className="px-4 py-2 rounded-lg border border-navy-600 text-sm hover:border-brand-cyan/50">
          + Nova entrada
        </button>
      )}
      {editando === 'nova' && formulario}

      {entradas.map((e) =>
        editando === e.id ? <div key={e.id}>{formulario}</div> : (
          <div key={e.id} className={`rounded-xl border border-navy-600 bg-navy-700 p-4 ${e.ativo ? '' : 'opacity-50'}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-text-2">
                  {CATEGORIAS.find((c) => c.value === e.categoria)?.label} · ordem {e.ordem} · atualizado {new Date(e.updated_at).toLocaleDateString('pt-BR')}
                  {!e.ativo && ' · INATIVA'}
                </p>
                <p className="font-semibold text-text-1">{e.titulo}</p>
              </div>
              {podeEscrever && (
                <div className="flex gap-2 text-sm">
                  <button onClick={() => abrir(e)} className="text-brand-cyan hover:underline">Editar</button>
                  <button onClick={() => void alternar(e)} className="text-text-2 hover:text-text-1">{e.ativo ? 'Desativar' : 'Ativar'}</button>
                </div>
              )}
            </div>
            <p className="text-sm text-text-2 whitespace-pre-wrap mt-2">{e.conteudo}</p>
          </div>
        ),
      )}
    </div>
  )
}
