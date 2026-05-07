'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import LogoAdaptive from '@/components/ui/LogoAdaptive'
import ThemeToggle from '@/components/ui/ThemeToggle'

const DEMO_KEY = 'sk_test_sandbox_demo'
// NEXT_PUBLIC_API_URL is set in Vercel env vars.
// Fallback to Railway URL so the sandbox works while the custom CNAME is pending.
const API_URL  = process.env.NEXT_PUBLIC_API_URL ?? 'https://api-production-73b1.up.railway.app'
const WEBHOOK_URL = `${API_URL}/v1/sandbox/webhook`

type Tab = 'curl' | 'node' | 'python'

interface HistoryEntry {
  id: string
  ts: string
  status: number
  body: Record<string, unknown>
  reqBody: Record<string, unknown>
}

const DEFAULT_BODY = {
  servico: {
    codigo_nbs: '01.01.01.10',
    discriminacao: 'Desenvolvimento de software',
    valor: 1500.00,
    aliquota_iss: 2.0,
  },
  tomador: {
    tipo: 'PJ',
    documento: '12345678000190',
    razao_social: 'Empresa Teste LTDA',
  },
  competencia: new Date().toISOString().slice(0, 7),
  webhook_url: WEBHOOK_URL,
}

function buildCurl(body: Record<string, unknown>) {
  return `curl -X POST ${API_URL}/v1/nfse \\
  -H "Authorization: Bearer ${DEMO_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'`
}

function buildNode(body: Record<string, unknown>) {
  return `import fetch from 'node-fetch'

const res = await fetch('${API_URL}/v1/nfse', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${DEMO_KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(${JSON.stringify(body, null, 2)}),
})

const data = await res.json()
console.log(data)`
}

function buildPython(body: Record<string, unknown>) {
  return `import httpx

response = httpx.post(
    "${API_URL}/v1/nfse",
    headers={
        "Authorization": "Bearer ${DEMO_KEY}",
        "Content-Type": "application/json",
    },
    json=${JSON.stringify(body, null, 4).replace(/"/g, '"')},
)
print(response.json())`
}

const LS_HISTORY = 'sandbox_history'
function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) ?? '[]') } catch { return [] }
}
function saveHistory(h: HistoryEntry[]) {
  localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(0, 10)))
}

function StatusBadge({ code }: { code: number }) {
  const ok = code >= 200 && code < 300
  const warn = code >= 400 && code < 500
  return (
    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
      ok   ? 'bg-nota-autorizada/15 border-nota-autorizada text-nota-autorizada' :
      warn ? 'bg-nota-processando/15 border-nota-processando text-nota-processando' :
             'bg-nota-rejeitada/15 border-nota-rejeitada text-nota-rejeitada'
    }`}>
      {code}
    </span>
  )
}

interface WebhookPayload { received_at: string; body: Record<string, unknown> }

export default function SandboxPage() {
  const [rawBody, setRawBody]       = useState(JSON.stringify(DEFAULT_BODY, null, 2))
  const [activeTab, setActiveTab]   = useState<Tab>('curl')
  const [response, setResponse]     = useState<{ status: number; data: Record<string, unknown> } | null>(null)
  const [loading, setLoading]       = useState(false)
  const [history, setHistory]       = useState<HistoryEntry[]>([])
  const [copied, setCopied]         = useState(false)
  const [keyCopied, setKeyCopied]   = useState(false)
  const [webhooks, setWebhooks]     = useState<WebhookPayload[]>([])
  const [rateLeft, setRateLeft]     = useState<number | null>(null)
  const [activeHistory, setActiveHistory] = useState<string | null>(null)

  useEffect(() => { setHistory(loadHistory()) }, [])

  const parsedBody = useMemo((): Record<string, unknown> | null => {
    try { return JSON.parse(rawBody) }
    catch { return null }
  }, [rawBody])

  const bodyError = useMemo((): string | null => {
    try { JSON.parse(rawBody); return null }
    catch (e) { return (e as Error).message }
  }, [rawBody])

  const snippets = useMemo((): Record<Tab, string> => ({
    curl:   buildCurl(parsedBody ?? DEFAULT_BODY),
    node:   buildNode(parsedBody ?? DEFAULT_BODY),
    python: buildPython(parsedBody ?? DEFAULT_BODY),
  }), [parsedBody])

  async function runDemo() {
    const body = parsedBody
    if (!body) return
    setLoading(true)
    setResponse(null)
    try {
      const res = await fetch(`${API_URL}/v1/nfse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${DEMO_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const remaining = res.headers.get('X-RateLimit-Remaining')
      if (remaining !== null) setRateLeft(parseInt(remaining, 10))
      const data = await res.json()
      const entry: HistoryEntry = { id: crypto.randomUUID(), ts: new Date().toISOString(), status: res.status, body: data, reqBody: body }
      setResponse({ status: res.status, data })
      const next = [entry, ...history].slice(0, 10)
      setHistory(next)
      saveHistory(next)
    } catch (err) {
      setResponse({ status: 0, data: { error: err instanceof Error ? err.message : 'Erro desconhecido' } })
    } finally {
      setLoading(false)
    }
  }

  async function fetchWebhooks() {
    try {
      const res = await fetch(`${WEBHOOK_URL}`)
      if (res.ok) setWebhooks(await res.json())
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    fetchWebhooks()
    const id = setInterval(fetchWebhooks, 5000)
    return () => clearInterval(id)
  }, [])

  function copySnippet() {
    navigator.clipboard.writeText(snippets[activeTab]).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function copyKey() {
    navigator.clipboard.writeText(DEMO_KEY).then(() => {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    })
  }

  function loadHistoryEntry(entry: HistoryEntry) {
    setRawBody(JSON.stringify(entry.reqBody, null, 2))
    setResponse({ status: entry.status, data: entry.body })
    setActiveHistory(entry.id)
  }

  return (
    <div className="min-h-screen bg-navy-900 text-text-1">
      {/* Header */}
      <div className="border-b border-navy-600 bg-navy-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/gateway" className="flex items-center shrink-0">
              <LogoAdaptive
                darkSrc="/brand/notafacil-logo.svg"
                lightSrc="/brand/notafacil-logo.svg"
                alt="Nota MEI Gateway"
                width={160}
                height={40}
              />
            </Link>
            <span className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 rounded-full px-2 py-0.5">
              Sandbox
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/docs" className="text-sm text-text-2 hover:text-text-1 transition">Docs</Link>
            <Link href="/cadastro?produto=gateway" className="text-sm font-semibold bg-brand-cyan text-navy-900 px-4 py-2 rounded-lg hover:opacity-90 transition">
              Criar conta →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold font-display">
            Teste a API em <span className="text-brand-cyan">30 segundos</span>
          </h1>
          <p className="text-text-2 text-lg max-w-xl mx-auto">
            Playground público. Nenhuma NFS-e é enviada à Receita Federal.
          </p>
        </div>

        {/* Demo key */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-text-2 uppercase tracking-wider mb-1">Chave de demonstração</p>
            <code className="font-mono text-sm text-brand-cyan">{DEMO_KEY}</code>
          </div>
          {rateLeft !== null && (
            <span className="text-xs text-text-2 border border-navy-600 rounded-full px-2 py-0.5">
              {rateLeft} req restantes/h
            </span>
          )}
          <button onClick={copyKey} className="px-3 py-2 text-xs font-semibold border border-brand-cyan/30 text-brand-cyan rounded-lg hover:bg-brand-cyan/10 transition">
            {keyCopied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Main playground — 2 columns on lg */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left: editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text-1">Body da requisição</h2>
              <button
                onClick={runDemo}
                disabled={loading || !!bodyError}
                className="px-5 py-2 bg-brand-cyan hover:opacity-90 text-navy-900 font-semibold rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? '⏳ Aguardando…' : '▶ Executar'}
              </button>
            </div>
            <textarea
              className={`w-full h-72 bg-navy-900 border rounded-xl px-4 py-3 text-sm font-mono text-text-1 focus:outline-none resize-none transition ${
                bodyError ? 'border-nota-rejeitada' : 'border-navy-600 focus:border-brand-cyan'
              }`}
              value={rawBody}
              onChange={e => setRawBody(e.target.value)}
              spellCheck={false}
              aria-label="Body JSON da requisição"
            />
            {bodyError && (
              <p className="text-xs text-nota-rejeitada font-mono">⚠ JSON inválido: {bodyError}</p>
            )}
          </div>

          {/* Right: response */}
          <div className="space-y-3">
            <h2 className="font-semibold text-text-1">Resposta</h2>
            <div className="h-72 bg-navy-900 border border-navy-600 rounded-xl overflow-auto">
              {response ? (
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge code={response.status} />
                    <span className="text-xs text-text-2">
                      {response.status === 0 ? 'Falha de conexão' : response.status >= 200 && response.status < 300 ? 'Sucesso' : 'Erro'}
                    </span>
                  </div>
                  <pre className="text-xs font-mono text-text-2 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-text-2 text-sm">
                  Execute uma requisição para ver a resposta aqui.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <h2 className="font-semibold text-text-1 mb-3">
              Histórico da sessão
              <span className="ml-2 text-xs font-normal text-text-2">({history.length}/10)</span>
            </h2>
            <div className="flex gap-2 flex-wrap">
              {history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => loadHistoryEntry(entry)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition ${
                    activeHistory === entry.id
                      ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/5'
                      : 'border-navy-600 text-text-2 hover:border-brand-cyan hover:text-text-1'
                  }`}
                >
                  <StatusBadge code={entry.status} />
                  <span className="ml-2">{new Date(entry.ts).toLocaleTimeString('pt-BR', { timeStyle: 'short' })}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Code snippets */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl overflow-hidden">
          <div className="flex border-b border-navy-600">
            {(['curl', 'node', 'python'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-brand-cyan border-b-2 border-brand-cyan bg-brand-cyan/5'
                    : 'text-text-2 hover:text-text-1'
                }`}
              >
                {tab === 'curl' ? 'cURL' : tab === 'node' ? 'Node.js' : 'Python'}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={copySnippet}
              className="px-4 py-3 text-xs text-text-2 hover:text-brand-cyan transition"
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="p-6 text-sm font-mono text-text-2 overflow-x-auto whitespace-pre leading-relaxed max-h-64">
            <code>{snippets[activeTab]}</code>
          </pre>
        </div>

        {/* Webhooks monitor */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-text-1">Monitor de webhooks</h2>
              <p className="text-sm text-text-2 mt-0.5">
                URL para <code className="text-brand-cyan">webhook_url</code>:{' '}
                <code className="text-xs font-mono">{WEBHOOK_URL}</code>
              </p>
            </div>
            <button
              onClick={fetchWebhooks}
              className="text-xs text-text-2 border border-navy-600 px-3 py-1.5 rounded-lg hover:border-brand-cyan hover:text-text-1 transition"
            >
              ↻ Atualizar
            </button>
          </div>

          {webhooks.length === 0 ? (
            <p className="text-sm text-text-2 text-center py-4">
              Nenhum webhook recebido ainda. Execute uma requisição para ver os callbacks.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {webhooks.slice(0, 20).map((wh, i) => (
                <div key={i} className="bg-navy-900 border border-navy-600 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs font-mono text-brand-cyan">
                      {String((wh.body as { event?: string }).event ?? 'evento')}
                    </code>
                    <span className="text-xs text-text-2">
                      {new Date(wh.received_at).toLocaleTimeString('pt-BR', { timeStyle: 'medium' })}
                    </span>
                  </div>
                  <pre className="text-xs font-mono text-text-2 whitespace-pre-wrap leading-relaxed line-clamp-3">
                    {JSON.stringify(wh.body, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-text-2">
            Últimos 20 payloads · Polling a cada 5 segundos
          </p>
        </div>

        {/* Limits */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Req / hora por IP', value: '20' },
            { label: 'Latência simulada', value: '~300ms' },
            { label: 'Webhooks no monitor', value: 'últimos 20' },
          ].map(item => (
            <div key={item.label} className="bg-navy-700 border border-navy-600 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-brand-cyan">{item.value}</p>
              <p className="text-sm text-text-2 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center py-6">
          <p className="text-text-2 mb-4">Pronto para emitir notas reais?</p>
          <a href="https://emitirnotafacil.com.br/cadastro" className="inline-block px-8 py-3 bg-brand-cyan hover:opacity-90 text-navy-900 font-bold rounded-xl transition">
            Criar conta grátis →
          </a>
        </div>
      </div>
    </div>
  )
}
