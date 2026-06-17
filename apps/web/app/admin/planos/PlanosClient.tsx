'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import notify from '@/lib/notify'
import type { PlanoRow } from './page'

interface Props {
  initialPlanos: PlanoRow[]
  canWrite: boolean
}

export default function PlanosClient({ initialPlanos, canWrite }: Props) {
  const router = useRouter()
  const [planos, setPlanos] = useState(initialPlanos)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showInativos, setShowInativos] = useState(false)
  const editing = planos.find((p) => p.id === editingId) ?? null
  // QA 2026-06-17 observação: 5 planos legacy inativos poluíam a listagem.
  // Fix: padrão é esconder; toggle "Mostrar inativos" pra inspecionar.
  const visiblePlanos = showInativos ? planos : planos.filter((p) => p.ativo)
  const inativoCount = planos.length - planos.filter((p) => p.ativo).length

  async function save(id: string, patch: Partial<PlanoRow>) {
    const res = await fetch(`/admin/api/planos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (res.ok) {
      setPlanos((arr) => arr.map((p) => (p.id === id ? { ...p, ...data.plano } : p)))
      notify.success('Plano salvo', data.stripe?.errors?.length ? `Stripe: ${data.stripe.errors.join('; ')}` : undefined)
      setEditingId(null)
      router.refresh()
    } else {
      notify.error('Erro ao salvar', data.message)
    }
  }

  async function resync(id: string) {
    const res = await fetch(`/admin/api/planos/${id}/resync`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      notify.success('Resync OK', `Product updated: ${data.productUpdated}`)
      router.refresh()
    } else {
      notify.error('Erro no resync', data.message)
    }
  }

  return (
    <>
      {inativoCount > 0 && (
        <div className="mb-4 flex items-center justify-between text-xs">
          <span className="text-text-2">{inativoCount} plano(s) inativo(s) ocultos</span>
          <button
            onClick={() => setShowInativos((v) => !v)}
            className="text-brand-cyan hover:underline"
          >
            {showInativos ? 'Esconder inativos' : 'Mostrar inativos'}
          </button>
        </div>
      )}
      <div className="rounded-xl border border-navy-600 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-700 border-b border-navy-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Plano</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-2 uppercase">Limite</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-2 uppercase">Preço</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-2 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-2 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlanos.map((p) => (
              <tr key={p.id} className="border-b border-navy-600 last:border-0 hover:bg-navy-700/30">
                <td className="px-4 py-3">
                  <p className="text-text-1 font-medium">
                    {p.nome}
                    {p.destaque && <span className="ml-2 text-xs px-2 py-0.5 bg-nota-upgrade/20 text-nota-upgrade rounded-full">★ destaque</span>}
                  </p>
                  {p.descricao_curta && <p className="text-xs text-text-2 mt-0.5">{p.descricao_curta}</p>}
                </td>
                <td className="px-4 py-3 text-text-2 text-xs">{p.tipo_empresa ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono">{p.emissoes_limite}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {p.preco_mensal_brl
                    ? `R$ ${Number(p.preco_mensal_brl).toFixed(2).replace('.', ',')}/mês`
                    : p.preco_excedente_brl
                      ? `R$ ${Number(p.preco_excedente_brl).toFixed(2).replace('.', ',')}/nota`
                      : 'grátis'}
                </td>
                <td className="px-4 py-3">
                  {p.ativo ? (
                    <span className="text-xs text-nota-autorizada">● ativo</span>
                  ) : (
                    <span className="text-xs text-nota-cancelada">○ inativo</span>
                  )}
                  {p.stripe_sync_error && (
                    <p className="text-xs text-nota-rejeitada mt-0.5" title={p.stripe_sync_error}>
                      ⚠️ sync error
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canWrite ? (
                    <>
                      <button onClick={() => setEditingId(p.id)} className="text-xs text-brand-cyan hover:underline mr-3">
                        Editar
                      </button>
                      {p.stripe_sync_error && (
                        <button onClick={() => resync(p.id)} className="text-xs text-nota-processando hover:underline">
                          Resync
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-text-2 italic">somente leitura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditPlanoModal plano={editing} onClose={() => setEditingId(null)} onSave={(patch) => save(editing.id, patch)} />}
    </>
  )
}

function EditPlanoModal({
  plano,
  onClose,
  onSave,
}: {
  plano: PlanoRow
  onClose: () => void
  onSave: (patch: Partial<PlanoRow>) => Promise<void>
}) {
  const [nome, setNome] = useState(plano.nome)
  const [descricaoCurta, setDescricaoCurta] = useState(plano.descricao_curta ?? '')
  const [emissoesLimite, setEmissoesLimite] = useState(plano.emissoes_limite)
  const [precoMensal, setPrecoMensal] = useState(plano.preco_mensal_brl ?? 0)
  const [precoExcedente, setPrecoExcedente] = useState(plano.preco_excedente_brl ?? 0)
  const [destaque, setDestaque] = useState(plano.destaque)
  const [ordem, setOrdem] = useState(plano.ordem_exibicao)
  const [ativo, setAtivo] = useState(plano.ativo)
  const [submitting, setSubmitting] = useState(false)

  const precoMudou = Number(precoMensal) !== Number(plano.preco_mensal_brl ?? 0)
  const excedenteMudou = Number(precoExcedente) !== Number(plano.preco_excedente_brl ?? 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (precoMudou) {
      const ok = confirm(
        `Mudar o preço mensal cria um novo Stripe price + migra todas as assinaturas ativas.\n\n` +
          `Confirmar mudança de R$ ${Number(plano.preco_mensal_brl ?? 0).toFixed(2)} → R$ ${Number(precoMensal).toFixed(2)}?`,
      )
      if (!ok) return
    }
    setSubmitting(true)
    await onSave({
      nome,
      descricao_curta: descricaoCurta || null,
      emissoes_limite: Number(emissoesLimite),
      preco_mensal_brl: Number(precoMensal) || null,
      preco_excedente_brl: Number(precoExcedente) || null,
      destaque,
      ordem_exibicao: Number(ordem),
      ativo,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-navy-700 border border-navy-600 rounded-xl p-6 max-w-lg w-full">
        <h2 className="font-display text-xl font-extrabold mb-1">{plano.nome}</h2>
        <p className="text-xs text-text-2 mb-4">stripe_price_id: <code className="text-brand-cyan">{plano.stripe_price_id || '(novo)'}</code></p>

        <div className="space-y-3 mb-6">
          <Field label="Nome">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Descrição curta (Stripe Checkout + landing)">
            <input value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} className={inputCls} maxLength={255} />
          </Field>
          <Field label="Emissões/mês">
            <input type="number" value={emissoesLimite} onChange={(e) => setEmissoesLimite(Number(e.target.value))} className={inputCls} min={0} />
          </Field>
          <Field label="Preço mensal (R$) — assinatura">
            <input type="number" step="0.01" value={precoMensal} onChange={(e) => setPrecoMensal(Number(e.target.value))} className={inputCls} min={0} />
            {precoMudou && (
              <p className="text-xs text-nota-processando mt-1">⚠️ Mudar preço migra assinaturas ativas</p>
            )}
            <p className="text-xs text-text-2 mt-1">Use 0 pra planos sem mensalidade (Avulso, Trial).</p>
          </Field>
          <Field label="Preço por nota (R$) — avulso ou excedente">
            <input type="number" step="0.01" value={precoExcedente} onChange={(e) => setPrecoExcedente(Number(e.target.value))} className={inputCls} min={0} />
            {excedenteMudou && (
              <p className="text-xs text-nota-processando mt-1">⚠️ Valor cobrado por nota acima do limite (ou cada nota, se Avulso).</p>
            )}
          </Field>
          <Field label="Ordem de exibição (menor primeiro)">
            <input type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className={inputCls} />
          </Field>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} className="accent-brand-cyan" />
              Destaque (★)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="accent-brand-cyan" />
              Ativo
            </label>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-2">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="bg-brand-cyan text-navy-900 font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls = 'w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-2 mb-1">{label}</label>
      {children}
    </div>
  )
}
