'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { formatCNPJ } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { features, type PlanTier } from '@/lib/plan-tier'

// ── Types ─────────────────────────────────────────────────────────────────────
type Aba = 'perfil' | 'certificado' | 'api-keys' | 'webhook'

interface MEIData {
  cnpj: string
  razao_social: string
  email: string
  municipio_ibge: string
  cert_valid_until: string | null
  /** Obrigatória pra ME/EPP. MEI dispensa (regime simplificado). */
  inscricao_municipal?: string | null
  tipo?: string | null
}

interface APIKey {
  id: string
  key_prefix: string
  label: string | null
  created_at: string
}

interface Props {
  mei: MEIData
  apiKeys: APIKey[]
  empresaTipo?: 'MEI' | 'ME' | 'EPP'
  /** Plan tier — trial/starter esconde abas API Keys + Webhook (feature Pro+). */
  planTier?: PlanTier
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
}

const inputCls =
  'bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-sm text-text-1 placeholder:text-text-2 focus:outline-none focus:border-brand-cyan transition w-full'

const readonlyCls =
  'bg-navy-900/50 border border-navy-600/50 rounded-lg px-3 py-2.5 text-sm text-text-2 w-full cursor-not-allowed select-all'

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${
      type === 'success'
        ? 'border-nota-autorizada/40 bg-nota-autorizada/10 text-nota-autorizada'
        : 'border-nota-rejeitada/40 bg-nota-rejeitada/10 text-nota-rejeitada'
    }`}>
      {msg}
    </div>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function PerfilTab({ mei }: { mei: MEIData }) {
  const [razaoSocial, setRazaoSocial] = useState(mei.razao_social)
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(mei.inscricao_municipal ?? '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const isMei = !mei.tipo || mei.tipo === 'MEI'
  const initialIM = mei.inscricao_municipal ?? ''

  const dirty = razaoSocial !== mei.razao_social || inscricaoMunicipal !== initialIM

  async function save() {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razao_social: razaoSocial,
          inscricao_municipal: inscricaoMunicipal.trim(),
        }),
      })
      if (res.ok) {
        setToast({ msg: 'Perfil atualizado com sucesso.', type: 'success' })
      } else {
        const d = await res.json()
        setToast({ msg: d.message ?? 'Erro ao salvar.', type: 'error' })
      }
    } catch {
      setToast({ msg: 'Falha de conexão.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      {toast && <Toast {...toast} />}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-2">CNPJ</label>
        <input className={readonlyCls} value={formatCNPJ(mei.cnpj)} readOnly />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-1">Razão Social</label>
        <input
          className={inputCls}
          value={razaoSocial}
          onChange={e => setRazaoSocial(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-2">E-mail</label>
        <input className={readonlyCls} value={mei.email} readOnly />
        <p className="text-xs text-text-2">O e-mail não pode ser alterado após o cadastro.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-2">Código IBGE do Município</label>
        <input className={readonlyCls} value={mei.municipio_ibge} readOnly />
      </div>

      {/* Inscrição Municipal — só pra ME/EPP. Pre-flight do backend (NFS-e
          Nacional E0116) exige IM cadastrada antes de emitir DPS. */}
      {!isMei && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-1">
            Inscrição Municipal{' '}
            <span className="text-nota-rejeitada">*</span>
          </label>
          <input
            className={inputCls}
            value={inscricaoMunicipal}
            onChange={e => setInscricaoMunicipal(e.target.value)}
            placeholder="Número da prefeitura (ex: 12345)"
            maxLength={30}
          />
          <p className="text-xs text-text-2">
            Obrigatória pra ME/EPP. Sem ela a Receita rejeita a DPS com erro
            E0116. Você encontra esse número no comprovante de inscrição da
            prefeitura ou na consulta do CNPJ municipal.
          </p>
        </div>
      )}

      <Button
        variant="primary"
        size="sm"
        loading={saving}
        disabled={saving || !dirty}
        onClick={save}
        className="self-start"
      >
        Salvar alterações
      </Button>

      {/* Segurança — link pra definir/trocar senha */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-navy-600">
        <h3 className="font-semibold text-sm text-text-1 mb-1">Segurança</h3>
        <p className="text-xs text-text-2 mb-3">
          Sua conta usa código por e-mail por padrão. Defina uma senha pra ter
          um login alternativo (útil pra testes).
        </p>
        <a
          href="/configuracoes/senha"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-cyan hover:underline"
        >
          Definir / trocar senha →
        </a>
      </div>
    </div>
  )
}

// ── Tab: Certificado ──────────────────────────────────────────────────────────
function CertificadoTab({ cert_valid_until }: { cert_valid_until: string | null }) {
  const days = daysUntil(cert_valid_until)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function upload() {
    if (!file || !password) return
    setUploading(true)
    setToast(null)
    try {
      const fd = new FormData()
      // Field names must match the Go backend (apps/api/internal/handler/certificate.go):
      //   form.File["certificado"]  + form.Value["senha_certificado"]
      fd.append('certificado', file)
      fd.append('senha_certificado', password)
      const res = await fetch('/api/certificate', { method: 'POST', body: fd })
      if (res.ok) {
        setToast({ msg: 'Certificado atualizado com sucesso.', type: 'success' })
        setFile(null)
        setPassword('')
      } else {
        const d = await res.json().catch(() => ({}))
        setToast({ msg: d.message ?? 'Erro ao enviar certificado.', type: 'error' })
      }
    } catch {
      setToast({ msg: 'Falha de conexão.', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      {/* Current status */}
      <div className={`rounded-xl border p-4 ${
        days === null ? 'border-navy-600 bg-navy-700'
        : days <= 0   ? 'border-nota-rejeitada/40 bg-nota-rejeitada/10'
        : days <= 30  ? 'border-nota-processando/40 bg-nota-processando/10'
        : 'border-nota-autorizada/40 bg-nota-autorizada/10'
      }`}>
        {days === null ? (
          <p className="text-text-2 text-sm">Nenhum certificado configurado.</p>
        ) : days <= 0 ? (
          <p className="text-nota-rejeitada text-sm font-semibold">🔴 Certificado expirado</p>
        ) : (
          <>
            <p className={`text-sm font-semibold ${days <= 30 ? 'text-nota-processando' : 'text-nota-autorizada'}`}>
              {days <= 30 ? `⚠️ Atenção: vence em ${days} dia${days !== 1 ? 's' : ''}` : '✅ Certificado válido'}
            </p>
            <p className="text-xs text-text-2 mt-1">
              Válido até {formatDate(cert_valid_until!)}
            </p>
          </>
        )}
      </div>

      {toast && <Toast {...toast} />}

      {/* Upload form */}
      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-text-1">
          {cert_valid_until ? 'Renovar certificado' : 'Enviar certificado A1'}
        </h3>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-1">Arquivo .pfx</label>
          <input
            type="file"
            accept=".pfx,.p12"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-text-2 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-navy-600 file:bg-navy-700 file:text-text-1 file:text-sm file:font-semibold hover:file:border-brand-cyan transition"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-text-1">Senha do certificado</label>
          <input
            type="password"
            className={inputCls}
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          loading={uploading}
          disabled={uploading || !file || !password}
          onClick={upload}
          className="self-start"
        >
          Upload certificado
        </Button>
      </div>
    </div>
  )
}

// ── Tab: API Keys ─────────────────────────────────────────────────────────────
function APIKeysTab({ initialKeys }: { initialKeys: APIKey[] }) {
  const [keys, setKeys] = useState(initialKeys)
  const [showModal, setShowModal] = useState(false)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function createKey() {
    setCreating(true)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      if (res.ok) {
        const d = await res.json()
        setNewKey(d.key)
        setKeys(prev => [{ id: 'new', key_prefix: d.prefix, label: label || null, created_at: new Date().toISOString() }, ...prev])
        setLabel('')
        setShowModal(false)
      } else {
        const d = await res.json()
        setToast({ msg: d.message ?? 'Erro ao criar key.', type: 'error' })
        setShowModal(false)
      }
    } catch {
      setToast({ msg: 'Falha de conexão.', type: 'error' })
      setShowModal(false)
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm('Revogar esta API Key? Esta ação não pode ser desfeita.')) return
    const res = await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setKeys(prev => prev.filter(k => k.id !== id))
      setToast({ msg: 'API Key revogada.', type: 'success' })
    } else {
      setToast({ msg: 'Erro ao revogar key.', type: 'error' })
    }
  }

  function copyKey() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {toast && <Toast {...toast} />}

      {/* New key display */}
      {newKey && (
        <div className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/5 p-4">
          <p className="text-sm font-semibold text-brand-cyan mb-2">🔑 Sua nova API Key (exibida apenas uma vez)</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <code className="flex-1 bg-navy-900 rounded-lg px-3 py-2 text-xs font-mono text-text-1 break-all">
              {newKey}
            </code>
            <Button variant="outline" size="sm" className="shrink-0" onClick={copyKey}>
              {copied ? '✓' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-text-2 mt-2">⚠️ Guarde-a agora — ela não será exibida novamente.</p>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-text-2 underline hover:text-nota-rejeitada transition">
            Fechar
          </button>
        </div>
      )}

      {/* Keys list */}
      {keys.length > 0 ? (
        <div className="rounded-xl border border-navy-600 overflow-hidden">
          {keys.map((k, i) => (
            <div
              key={k.id}
              className={`flex items-center gap-4 px-4 py-3 ${i > 0 ? 'border-t border-navy-600' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-brand-cyan">{k.key_prefix}••••••••</p>
                {k.label && <p className="text-xs text-text-2">{k.label}</p>}
              </div>
              <p className="text-xs text-text-2 shrink-0">Criada {formatDate(k.created_at)}</p>
              <Button variant="destructive" size="sm" className="shrink-0" onClick={() => revokeKey(k.id)}>
                Revogar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-text-2 text-sm">Nenhuma API Key ativa.</p>
      )}

      <Button variant="outline" size="sm" className="self-start" onClick={() => setShowModal(true)}>
        + Criar nova API Key
      </Button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-navy-700 border border-navy-600 rounded-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-display font-bold text-lg mb-4">Nova API Key</h3>
            <label className="text-sm font-medium text-text-1 block mb-1">Label (opcional)</label>
            <input
              className={inputCls}
              placeholder="Ex: ERP Produção"
              value={label}
              onChange={e => setLabel(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <Button variant="primary" className="flex-1" loading={creating} onClick={createKey}>
                {creating ? 'Criando…' : 'Criar'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => { setShowModal(false); setLabel('') }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Webhook ──────────────────────────────────────────────────────────────
function WebhookTab() {
  const [url, setUrl] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mei_webhook_default') ?? ''
    return ''
  })
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ status: number; ok: boolean } | null>(null)
  const [testing, setTesting] = useState(false)

  function save() {
    localStorage.setItem('mei_webhook_default', url)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function sendTest() {
    if (!url) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'nfse.teste',
          nota_id: '00000000-0000-0000-0000-000000000000',
          status: 'AUTORIZADA',
          numero_nfse: '000001',
          emitida_em: new Date().toISOString(),
        }),
      })
      setTestResult({ status: res.status, ok: res.ok })
    } catch {
      setTestResult({ status: 0, ok: false })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-md">
      {/* TODO: persist webhook_url_padrao server-side in the meis table in a future migration */}
      <p className="text-xs text-text-2 border border-navy-600 rounded-lg px-3 py-2 bg-navy-700">
        💡 A URL padrão de webhook é salva localmente no seu navegador. Em breve será persistida na sua conta.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-text-1">URL de webhook padrão</label>
        <input
          type="url"
          className={inputCls}
          placeholder="https://seu-erp.com/webhooks/nfse"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <p className="text-xs text-text-2">Pré-preenchida em todas as novas emissões.</p>
      </div>

      <div className="flex gap-3">
        <Button variant="primary" size="sm" disabled={!url} onClick={save}>
          {saved ? '✓ Salvo' : 'Salvar'}
        </Button>
        <Button variant="secondary" size="sm" loading={testing} disabled={testing || !url} onClick={sendTest}>
          {testing ? 'Enviando…' : 'Enviar payload de teste'}
        </Button>
      </div>

      {testResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-mono ${
          testResult.ok
            ? 'border-nota-autorizada/40 bg-nota-autorizada/10 text-nota-autorizada'
            : 'border-nota-rejeitada/40 bg-nota-rejeitada/10 text-nota-rejeitada'
        }`}>
          {testResult.ok ? '✓' : '✗'}{' '}
          {testResult.status === 0 ? 'Falha de rede (URL inacessível)' : `HTTP ${testResult.status}`}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
const ALL_ABAS: { value: Aba; label: string; apiOnly?: boolean }[] = [
  { value: 'perfil',      label: 'Dados da empresa' },
  { value: 'certificado', label: 'Certificado A1'   },
  { value: 'api-keys',    label: 'Chaves de API',   apiOnly: true },
  { value: 'webhook',     label: 'Webhooks',        apiOnly: true },
]

export default function ConfiguracoesTabs({ mei, apiKeys, empresaTipo, planTier = 'trial' }: Props) {
  const router    = useRouter()
  const pathname  = usePathname()
  const params    = useSearchParams()
  const abaParam  = params.get('aba') as Aba | null

  // MEI dispensa abas API. ME/EPP em trial/starter também — feature Pro+.
  const isMei = !empresaTipo || empresaTipo === 'MEI'
  const apiAllowed = !isMei && features.canUseAPI(planTier)
  const ABAS = ALL_ABAS.filter(a => !a.apiOnly || apiAllowed)

  // If MEI navigates directly to ?aba=api-keys via URL, fall back to perfil
  const aba: Aba  = ABAS.some(a => a.value === abaParam) ? abaParam! : 'perfil'

  function setAba(a: Aba) {
    router.push(`${pathname}?aba=${a}`)
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-navy-600 mb-8">
        {ABAS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setAba(value)}
            className={`px-3 sm:px-4 py-3 text-sm font-semibold transition -mb-px border-b-2 whitespace-nowrap ${
              aba === value
                ? 'text-brand-cyan border-brand-cyan'
                : 'text-text-2 border-transparent hover:text-text-1'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {aba === 'perfil'      && <PerfilTab mei={mei} />}
      {aba === 'certificado' && <CertificadoTab cert_valid_until={mei.cert_valid_until} />}
      {aba === 'api-keys'    && !isMei && <APIKeysTab initialKeys={apiKeys} />}
      {aba === 'webhook'     && !isMei && <WebhookTab />}
    </div>
  )
}
