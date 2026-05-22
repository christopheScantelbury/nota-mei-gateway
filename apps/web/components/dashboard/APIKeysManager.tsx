'use client'

import { useState } from 'react'
import type { APIKey } from '@/app/(dashboard)/api-keys/page'

type Env = 'live' | 'test'

interface Props {
  initialKeys: APIKey[]
  planName: string
  maxKeys: number
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

function envFromPrefix(prefix: string): Env {
  return prefix.startsWith('sk_test_') ? 'test' : 'live'
}

function maskKey(prefix: string) {
  return `${prefix}••••••••••••••••••••••••••••••••••••••••••••••••`
}

// ── Revoke confirmation modal ─────────────────────────────────────────────────
function RevokeModal({
  keyLabel,
  onConfirm,
  onCancel,
  loading,
}: {
  keyLabel: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-700 border border-navy-600 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-display font-bold text-lg text-text-1 mb-2">Revogar API Key</h3>
        <p className="text-sm text-text-2 mb-1">
          Você está prestes a revogar a chave:
        </p>
        <code className="block text-xs font-mono text-brand-cyan bg-navy-900 rounded-lg px-3 py-2 mb-4 break-all">
          {keyLabel}
        </code>
        <p className="text-sm text-nota-rejeitada font-semibold mb-5">
          ⚠️ Esta ação é irreversível. Qualquer integração que usar esta chave irá falhar.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-nota-rejeitada text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Revogando...' : 'Revogar'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-navy-600 text-text-2 font-semibold text-sm py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create modal ──────────────────────────────────────────────────────────────
function CreateModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (label: string, env: Env) => void
  onCancel: () => void
  loading: boolean
}) {
  const [label, setLabel] = useState('')
  const [env, setEnv]     = useState<Env>('live')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-navy-700 border border-navy-600 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-display font-bold text-lg text-text-1 mb-4">Nova API Key</h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-text-1 block mb-1">Ambiente</label>
            <div className="flex gap-2">
              {(['live', 'test'] as Env[]).map(e => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={[
                    'flex-1 py-2.5 rounded-lg text-sm font-semibold border transition',
                    env === e
                      ? e === 'live'
                        ? 'bg-nota-autorizada/15 border-nota-autorizada text-nota-autorizada'
                        : 'bg-nota-upgrade/15 border-nota-upgrade text-nota-upgrade'
                      : 'border-navy-600 text-text-2 hover:border-brand-cyan hover:text-text-1',
                  ].join(' ')}
                >
                  {e === 'live' ? '🟢 Produção' : '🟣 Sandbox'}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-2 mt-1.5">
              {env === 'live'
                ? 'Chave sk_live_ — emite NFS-e reais na Receita Federal.'
                : 'Chave sk_test_ — somente ambiente de sandbox, sem emissões reais.'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-text-1 block mb-1">
              Label <span className="text-text-2 font-normal">(opcional)</span>
            </label>
            <input
              className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full"
              placeholder="Ex: ERP Produção, Integração Zapier"
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') onConfirm(label, env) }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => onConfirm(label, env)}
            disabled={loading}
            className="flex-1 bg-brand-cyan text-navy-900 font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar chave'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-navy-600 text-text-2 font-semibold text-sm py-2.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Key row ───────────────────────────────────────────────────────────────────
function KeyRow({
  k,
  onRevoke,
}: {
  k: APIKey
  onRevoke: (k: APIKey) => void
}) {
  const revoked = Boolean(k.revoked_at)
  return (
    <div className="flex items-center gap-4 px-4 py-3 group">
      <div className="flex-1 min-w-0">
        <p className={`font-mono text-sm break-all ${revoked ? 'text-text-2 line-through' : 'text-brand-cyan'}`}>
          {maskKey(k.key_prefix)}
        </p>
        <p className="text-xs text-text-2 mt-0.5">
          {k.label ? <span className="font-medium">{k.label} · </span> : null}
          Criada em {formatDate(k.created_at)}
          {revoked && k.revoked_at ? ` · Revogada em ${formatDate(k.revoked_at)}` : ''}
        </p>
      </div>

      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${
        revoked
          ? 'text-text-2 border-navy-600 bg-navy-700'
          : 'text-nota-autorizada border-nota-autorizada/40 bg-nota-autorizada/10'
      }`}>
        {revoked ? 'Revogada' : 'Ativa'}
      </span>

      {!revoked && (
        <button
          onClick={() => onRevoke(k)}
          className="shrink-0 text-xs text-nota-rejeitada border border-nota-rejeitada/30 px-3 py-1 rounded-lg hover:bg-nota-rejeitada/10 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          Revogar
        </button>
      )}
    </div>
  )
}

// ── Section (live / test) ─────────────────────────────────────────────────────
function KeySection({
  env,
  keys,
  onRevoke,
}: {
  env: Env
  keys: APIKey[]
  onRevoke: (k: APIKey) => void
}) {
  const active  = keys.filter(k => !k.revoked_at)
  const revoked = keys.filter(k => k.revoked_at)
  const [showRevoked, setShowRevoked] = useState(false)

  const title = env === 'live' ? '🟢 Produção' : '🟣 Sandbox'
  const desc  = env === 'live'
    ? 'Chaves sk_live_ — usadas para emitir NFS-e reais.'
    : 'Chaves sk_test_ — somente para testes e desenvolvimento.'

  return (
    <div className="rounded-xl border border-navy-600 overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-600 bg-navy-700/50">
        <p className="font-semibold text-sm text-text-1">{title}</p>
        <p className="text-xs text-text-2 mt-0.5">{desc}</p>
      </div>

      {active.length === 0 ? (
        <p className="px-4 py-5 text-sm text-text-2">Nenhuma chave ativa neste ambiente.</p>
      ) : (
        <div className="divide-y divide-navy-600">
          {active.map(k => (
            <KeyRow key={k.id} k={k} onRevoke={onRevoke} />
          ))}
        </div>
      )}

      {revoked.length > 0 && (
        <div className="border-t border-navy-600">
          <button
            onClick={() => setShowRevoked(v => !v)}
            className="w-full text-left px-4 py-2.5 text-xs text-text-2 hover:text-text-1 transition flex items-center gap-1"
          >
            <span>{showRevoked ? '▾' : '▸'}</span>
            {revoked.length} chave{revoked.length !== 1 ? 's' : ''} revogada{revoked.length !== 1 ? 's' : ''}
          </button>
          {showRevoked && (
            <div className="divide-y divide-navy-600 opacity-60">
              {revoked.map(k => <KeyRow key={k.id} k={k} onRevoke={onRevoke} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function APIKeysManager({ initialKeys, planName, maxKeys }: Props) {
  const [keys, setKeys]           = useState(initialKeys)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [revoking, setRevoking]   = useState<APIKey | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [newKey, setNewKey]       = useState<string | null>(null)
  const [copied, setCopied]       = useState(false)
  const [toast, setToast]         = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const activeCount = keys.filter(k => !k.revoked_at).length

  function showToast(msg: string, type: 'ok' | 'err') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleCreate(label: string, env: Env) {
    setCreating(true)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, env }),
      })
      const d = await res.json()
      if (res.ok) {
        setNewKey(d.key)
        setKeys(prev => [{
          id: crypto.randomUUID(),
          key_prefix: d.prefix,
          label: label.trim() || null,
          created_at: new Date().toISOString(),
          revoked_at: null,
        }, ...prev])
        setShowCreate(false)
      } else {
        showToast(d.message ?? 'Erro ao criar chave.', 'err')
        setShowCreate(false)
      }
    } catch {
      showToast('Falha de conexão.', 'err')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!revoking) return
    setRevokeLoading(true)
    try {
      const res = await fetch(`/api/keys?id=${revoking.id}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys(prev => prev.map(k =>
          k.id === revoking.id ? { ...k, revoked_at: new Date().toISOString() } : k
        ))
        showToast('API Key revogada com sucesso.', 'ok')
      } else {
        showToast('Erro ao revogar chave.', 'err')
      }
    } catch {
      showToast('Falha de conexão.', 'err')
    } finally {
      setRevokeLoading(false)
      setRevoking(null)
    }
  }

  function copyNewKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const liveKeys = keys.filter(k => envFromPrefix(k.key_prefix) === 'live')
  const testKeys = keys.filter(k => envFromPrefix(k.key_prefix) === 'test')

  return (
    <div className="flex flex-col gap-6">
      {/* Plan + quota bar */}
      <div className="flex items-center justify-between rounded-xl border border-navy-600 bg-navy-700 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text-1">Plano {planName}</p>
          <p className="text-xs text-text-2 mt-0.5">
            {activeCount} de {maxKeys} chaves ativas utilizadas
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="w-24 sm:w-40 h-1.5 rounded-full bg-navy-600 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-cyan transition-all"
              style={{ width: `${Math.min(100, (activeCount / maxKeys) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-text-2">{activeCount}/{maxKeys}</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          toast.type === 'ok'
            ? 'border-nota-autorizada/40 bg-nota-autorizada/10 text-nota-autorizada'
            : 'border-nota-rejeitada/40 bg-nota-rejeitada/10 text-nota-rejeitada'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* New key one-time display */}
      {newKey && (
        <div className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/5 p-4">
          <p className="text-sm font-semibold text-brand-cyan mb-2">
            🔑 Sua nova API Key — exibida apenas uma vez
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 bg-navy-900 rounded-lg px-3 py-2 text-xs font-mono text-text-1 break-all">
              {newKey}
            </code>
            <button
              onClick={copyNewKey}
              className="shrink-0 border border-brand-cyan text-brand-cyan text-xs font-semibold px-3 py-2 rounded-lg hover:bg-brand-cyan/10 transition"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-text-2 mt-2">
            ⚠️ Guarde-a agora — ela não será exibida novamente.
          </p>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-text-2 underline hover:text-nota-rejeitada transition"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Sections */}
      <KeySection env="live" keys={liveKeys} onRevoke={setRevoking} />
      <KeySection env="test" keys={testKeys} onRevoke={setRevoking} />

      {/* Create button */}
      <div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={activeCount >= maxKeys}
          className="border border-brand-cyan text-brand-cyan font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-brand-cyan/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Criar nova API Key
        </button>
        {activeCount >= maxKeys && (
          <p className="text-xs text-text-2 mt-2">
            Limite do plano atingido.{' '}
            <a href="/billing" className="text-brand-cyan hover:underline">Fazer upgrade →</a>
          </p>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
          loading={creating}
        />
      )}
      {revoking && (
        <RevokeModal
          keyLabel={maskKey(revoking.key_prefix)}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
          loading={revokeLoading}
        />
      )}
    </div>
  )
}
