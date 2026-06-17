'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import notify from '@/lib/notify'
import type { LandingPage, LandingSection } from '@/lib/admin/landing'

const SECTION_TYPES = [
  { tipo: 'hero',             label: 'Hero (título + CTA)' },
  { tipo: 'pricing',          label: 'Planos / Pricing' },
  { tipo: 'features',         label: 'Grade de features' },
  { tipo: 'faq',              label: 'FAQ' },
  { tipo: 'cta',              label: 'CTA final' },
  { tipo: 'testimonials',     label: 'Depoimentos' },
  { tipo: 'how_it_works',     label: 'Como funciona' },
  { tipo: 'urgency_banner',   label: 'Banner urgência' },
  { tipo: 'competitor_table', label: 'Tabela comparativo' },
  { tipo: 'ecossistema',      label: 'Ecossistema' },
  { tipo: 'custom_html',      label: 'HTML custom' },
]

interface Props {
  page: LandingPage
  canWrite: boolean
}

export default function LandingBuilder({ page, canWrite }: Props) {
  const router = useRouter()
  const [sections, setSections] = useState<LandingSection[]>(page.sections)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const selected = sections.find((s) => s.id === selectedId) ?? null

  function updateSection(id: string, patch: Partial<LandingSection>) {
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    setDirty(true)
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((arr) => {
      const idx = arr.findIndex((s) => s.id === id)
      if (idx < 0) return arr
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      const next = [...arr]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((s, i) => ({ ...s, ordem: i }))
    })
    setDirty(true)
  }

  async function addSection(tipo: string) {
    const ordem = sections.length
    const res = await fetch(`/admin/api/landing/${page.slug}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, ordem, draft_data: {} }),
    })
    if (res.ok) {
      const { section } = await res.json()
      setSections((arr) => [...arr, section])
      setSelectedId(section.id)
      notify.success(`Section ${tipo} adicionada`)
    } else {
      notify.error('Erro ao criar section', (await res.json()).message)
    }
  }

  async function deleteSection(id: string) {
    if (!confirm('Excluir esta section?')) return
    const res = await fetch(`/admin/api/landing/${page.slug}/sections/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setSections((arr) => arr.filter((s) => s.id !== id))
      setSelectedId(null)
      notify.success('Section removida')
    }
  }

  async function saveDraft() {
    const res = await fetch(`/admin/api/landing/${page.slug}/sections`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sections: sections.map((s) => ({
          id: s.id,
          ordem: s.ordem,
          draft_data: s.draft_data,
          visible: s.visible,
          tipo: s.tipo,
        })),
      }),
    })
    if (res.ok) {
      setDirty(false)
      notify.success('Rascunho salvo')
    } else {
      notify.error('Erro ao salvar', (await res.json()).message)
    }
  }

  async function publish() {
    if (dirty) {
      const ok = confirm('Existem mudanças não salvas. Salvar antes de publicar?')
      if (ok) await saveDraft()
    }
    if (!confirm(`Publicar /${page.slug}? Isso copia o draft pra versão pública.`)) return
    setPublishing(true)
    const res = await fetch(`/admin/api/landing/${page.slug}/publish`, { method: 'POST' })
    if (res.ok) {
      notify.success('Publicado! ✨')
      router.refresh()
    } else {
      notify.error('Erro ao publicar', (await res.json()).message)
    }
    setPublishing(false)
  }

  async function rollback() {
    if (!confirm('Reverter pra publicação anterior?')) return
    const res = await fetch(`/admin/api/landing/${page.slug}/rollback`, { method: 'POST' })
    if (res.ok) {
      notify.success('Rollback feito')
      router.refresh()
    } else {
      notify.error('Erro no rollback', (await res.json()).message)
    }
  }

  async function openPreview() {
    // Token assinado: GET na API gera token efêmero. Implementação simples:
    // usa o user_id em base64 + timestamp (server valida no SSR). Pra MVP
    // basta um param ?preview=1 que o /(landing) detecta em modo logado.
    const url = `/${page.slug === 'home' ? '' : page.slug}?preview=1`
    window.open(url, '_blank')
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <Link href="/admin/landing" className="text-xs text-text-2 hover:text-text-1 mb-1 block">
            ← todas as páginas
          </Link>
          <h1 className="font-display text-2xl font-extrabold">
            /{page.slug === 'home' ? '' : page.slug}
          </h1>
          {page.published_at && (
            <p className="text-xs text-text-2">Última publish: {new Date(page.published_at).toLocaleString('pt-BR')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={openPreview} className="text-sm px-3 py-2 rounded-lg bg-navy-700 text-text-1 border border-navy-600 hover:border-brand-cyan">
            👁 Preview
          </button>
          {canWrite && (
            <>
              <button
                onClick={saveDraft}
                disabled={!dirty}
                className="text-sm px-3 py-2 rounded-lg bg-navy-700 text-text-1 border border-navy-600 disabled:opacity-50"
              >
                💾 Salvar {dirty && '*'}
              </button>
              <button
                onClick={publish}
                disabled={publishing}
                className="text-sm px-4 py-2 rounded-lg bg-brand-cyan text-navy-900 font-semibold disabled:opacity-50"
              >
                ✨ Publicar
              </button>
              {page.published && (
                <button onClick={rollback} className="text-sm px-3 py-2 rounded-lg bg-navy-700 text-nota-rejeitada border border-navy-600">
                  ↶ Rollback
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Grid: sections list | section editor */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sections list */}
        <div>
          <h2 className="text-xs font-semibold text-text-2 uppercase mb-2">Sections</h2>
          <div className="space-y-1 mb-4">
            {sections.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 p-2 rounded-lg border ${
                  selectedId === s.id ? 'border-brand-cyan bg-brand-cyan/5' : 'border-navy-600 bg-navy-700/50'
                }`}
              >
                <button
                  onClick={() => setSelectedId(s.id)}
                  className="flex-1 text-left text-sm"
                >
                  <span className="text-text-2 mr-2">#{i + 1}</span>
                  <span className={s.visible ? '' : 'opacity-50 line-through'}>{s.tipo}</span>
                </button>
                {canWrite && (
                  <>
                    <button onClick={() => moveSection(s.id, -1)} disabled={i === 0} className="text-xs text-text-2 disabled:opacity-30" aria-label="Subir">↑</button>
                    <button onClick={() => moveSection(s.id, 1)} disabled={i === sections.length - 1} className="text-xs text-text-2 disabled:opacity-30" aria-label="Descer">↓</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {canWrite && (
            <details className="mt-4">
              <summary className="text-xs text-brand-cyan cursor-pointer">+ Adicionar section</summary>
              <div className="space-y-1 mt-2">
                {SECTION_TYPES.map((t) => (
                  <button
                    key={t.tipo}
                    onClick={() => addSection(t.tipo)}
                    className="block w-full text-left text-xs p-2 rounded bg-navy-800 hover:bg-navy-700"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Section editor */}
        <div>
          {selected ? (
            <SectionEditor
              section={selected}
              canWrite={canWrite}
              onChange={(patch) => updateSection(selected.id, patch)}
              onDelete={() => deleteSection(selected.id)}
            />
          ) : (
            <div className="rounded-xl border border-navy-600 p-12 text-center text-text-2 text-sm">
              Selecione uma section pra editar.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SectionEditor({
  section,
  canWrite,
  onChange,
  onDelete,
}: {
  section: LandingSection
  canWrite: boolean
  onChange: (patch: Partial<LandingSection>) => void
  onDelete: () => void
}) {
  const [json, setJson] = useState(JSON.stringify(section.draft_data, null, 2))
  const [jsonErr, setJsonErr] = useState<string | null>(null)

  function tryParse(s: string) {
    setJson(s)
    try {
      const parsed = JSON.parse(s)
      onChange({ draft_data: parsed })
      setJsonErr(null)
    } catch (e) {
      setJsonErr(e instanceof Error ? e.message : 'JSON inválido')
    }
  }

  return (
    <div className="rounded-xl border border-navy-600 p-5 bg-navy-700/30">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display font-extrabold text-lg">{section.tipo}</p>
          <p className="text-xs text-text-2">id: {section.id.slice(0, 8)}…</p>
        </div>
        {canWrite && (
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={section.visible}
                onChange={(e) => onChange({ visible: e.target.checked })}
                className="accent-brand-cyan"
              />
              Visível
            </label>
            <button onClick={onDelete} className="text-xs text-nota-rejeitada hover:underline">
              Excluir
            </button>
          </div>
        )}
      </div>

      <label className="block text-xs font-semibold text-text-2 mb-1">draft_data (JSON)</label>
      <textarea
        value={json}
        onChange={(e) => tryParse(e.target.value)}
        disabled={!canWrite}
        rows={20}
        className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-xs font-mono"
      />
      {jsonErr && <p className="text-xs text-nota-rejeitada mt-1">⚠️ {jsonErr}</p>}
      <p className="text-xs text-text-2 mt-2">
        Conteúdo livre por tipo. Ex: hero → {`{title, subtitle, cta_label, cta_href}`}.
      </p>
    </div>
  )
}
