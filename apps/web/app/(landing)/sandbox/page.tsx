'use client'

import { useState } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'

const DEMO_KEY = 'sk_test_sandbox_demo'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
const SANDBOX_WEBHOOK = `${API_URL}/v1/sandbox/webhook`

const CURL_EXAMPLE = `curl -X POST ${API_URL}/v1/nfse \\
  -H "Authorization: Bearer ${DEMO_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "servico": {
      "codigo_nbs": "01.01.01.10",
      "discriminacao": "Desenvolvimento de software",
      "valor": 1500.00,
      "aliquota_iss": 2.0
    },
    "tomador": {
      "tipo": "PJ",
      "documento": "12345678000190",
      "razao_social": "Empresa Teste LTDA"
    },
    "competencia": "2026-04",
    "webhook_url": "${SANDBOX_WEBHOOK}"
  }'`

const NODE_EXAMPLE = `import fetch from 'node-fetch'

const res = await fetch('${API_URL}/v1/nfse', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${DEMO_KEY}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
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
    competencia: '2026-04',
    webhook_url: '${SANDBOX_WEBHOOK}',
  }),
})

const data = await res.json()
console.log(data)`

const PYTHON_EXAMPLE = `import httpx

response = httpx.post(
    "${API_URL}/v1/nfse",
    headers={
        "Authorization": "Bearer ${DEMO_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "servico": {
            "codigo_nbs": "01.01.01.10",
            "discriminacao": "Desenvolvimento de software",
            "valor": 1500.00,
            "aliquota_iss": 2.0,
        },
        "tomador": {
            "tipo": "PJ",
            "documento": "12345678000190",
            "razao_social": "Empresa Teste LTDA",
        },
        "competencia": "2026-04",
        "webhook_url": "${SANDBOX_WEBHOOK}",
    },
)

print(response.json())`

type Tab = 'curl' | 'node' | 'python'

export default function SandboxPage() {
  const [activeTab, setActiveTab] = useState<Tab>('curl')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notaId, setNotaId] = useState<string | null>(null)

  const snippets: Record<Tab, string> = {
    curl: CURL_EXAMPLE,
    node: NODE_EXAMPLE,
    python: PYTHON_EXAMPLE,
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(DEMO_KEY)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const runDemo = async () => {
    setLoading(true)
    setResponse(null)
    try {
      const res = await fetch(`${API_URL}/v1/nfse`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DEMO_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          servico: {
            codigo_nbs: '01.01.01.10',
            discriminacao: 'Desenvolvimento de software — sandbox demo',
            valor: 1500.0,
            aliquota_iss: 2.0,
          },
          tomador: {
            tipo: 'PJ',
            documento: '12345678000190',
            razao_social: 'Empresa Teste LTDA',
          },
          competencia: new Date().toISOString().slice(0, 7),
          webhook_url: SANDBOX_WEBHOOK,
        }),
      })
      const data = await res.json()
      setResponse(JSON.stringify(data, null, 2))
      if (data.nota_id) setNotaId(data.nota_id)
    } catch (err) {
      setResponse(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchNota = async () => {
    if (!notaId) return
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/v1/nfse/${notaId}`, {
        headers: { Authorization: `Bearer ${DEMO_KEY}` },
      })
      const data = await res.json()
      setResponse(JSON.stringify(data, null, 2))
    } catch (err) {
      setResponse(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-navy-900 text-text-1">
      {/* Header */}
      <div className="border-b border-navy-600 bg-navy-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-display text-brand-cyan">Nota MEI</span>
            <span className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 rounded-full px-2 py-0.5">
              Sandbox
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://notameigateway.com.br"
              className="text-sm text-text-2 hover:text-text-1 transition-colors"
            >
              Criar conta grátis →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold font-display text-text-1">
            Teste a API em{' '}
            <span className="text-brand-cyan">30 segundos</span>
          </h1>
          <p className="text-text-2 text-lg max-w-xl mx-auto">
            Ambiente sandbox público. Nenhuma NFS-e é enviada à Receita Federal — todas as
            respostas são simuladas com dados realistas.
          </p>
        </div>

        {/* Demo Key */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 space-y-3 shadow-card">
          <p className="text-sm text-text-2 font-medium uppercase tracking-wider">
            Chave de demonstração (sem cadastro)
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-brand-cyan font-mono text-sm">
              {DEMO_KEY}
            </code>
            <button
              onClick={copyKey}
              className="px-4 py-3 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {copied ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-text-2">
            Limite: 20 requisições/hora por IP · Dados resetam a cada reinício do servidor
          </p>
        </div>

        {/* Quick Run */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg text-text-1">Emitir nota agora</h2>
            <div className="flex gap-2">
              {notaId && (
                <button
                  onClick={fetchNota}
                  disabled={loading}
                  className="px-4 py-2 bg-navy-600 hover:bg-navy-600/80 border border-navy-600 rounded-lg text-sm text-text-2 hover:text-text-1 transition-colors disabled:opacity-50"
                >
                  Consultar nota
                </button>
              )}
              <button
                onClick={runDemo}
                disabled={loading}
                className="px-5 py-2 bg-brand-cyan hover:opacity-90 text-navy-900 font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Aguardando…' : '▶ Executar'}
              </button>
            </div>
          </div>

          {response && (
            <pre className="bg-navy-900 border border-navy-600 rounded-lg p-4 text-sm font-mono text-brand-cyan overflow-x-auto whitespace-pre-wrap">
              {response}
            </pre>
          )}
        </div>

        {/* Code Snippets */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl overflow-hidden shadow-card">
          <div className="flex border-b border-navy-600">
            {(['curl', 'node', 'python'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'px-6 py-3 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'text-brand-cyan border-b-2 border-brand-cyan bg-brand-cyan/5'
                    : 'text-text-2 hover:text-text-1',
                ].join(' ')}
              >
                {tab === 'curl' ? 'cURL' : tab === 'node' ? 'Node.js' : 'Python'}
              </button>
            ))}
          </div>
          <pre className="p-6 text-sm font-mono text-text-2 overflow-x-auto whitespace-pre leading-relaxed">
            <code>{snippets[activeTab]}</code>
          </pre>
        </div>

        {/* Webhook Monitor */}
        <div className="bg-navy-700 border border-navy-600 rounded-xl p-6 space-y-4 shadow-card">
          <div>
            <h2 className="font-semibold text-lg text-text-1">Webhook de teste</h2>
            <p className="text-sm text-text-2 mt-1">
              Use esta URL no campo <code className="text-brand-cyan">webhook_url</code> para
              receber callbacks simulados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-4 py-3 text-brand-cyan font-mono text-sm break-all">
              {SANDBOX_WEBHOOK}
            </code>
          </div>
          <p className="text-xs text-text-2">
            Os últimos 20 payloads recebidos ficam disponíveis em{' '}
            <code className="text-text-2">GET {SANDBOX_WEBHOOK}</code>
          </p>
        </div>

        {/* Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Req / hora por IP', value: '20' },
            { label: 'Latência simulada', value: '~300ms' },
            { label: 'Webhooks armazenados', value: 'últimos 20' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-navy-700 border border-navy-600 rounded-xl p-4 text-center shadow-card"
            >
              <p className="text-2xl font-bold font-display text-brand-cyan">{item.value}</p>
              <p className="text-sm text-text-2 mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 py-8">
          <p className="text-text-2">Pronto para emitir notas reais?</p>
          <a
            href="https://notameigateway.com.br/cadastro"
            className="inline-block px-8 py-3 bg-brand-cyan hover:opacity-90 text-navy-900 font-bold rounded-xl transition-colors"
          >
            Criar conta grátis →
          </a>
        </div>
      </div>
    </main>
  )
}
