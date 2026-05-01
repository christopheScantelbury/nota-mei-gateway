'use client'

import { useState } from 'react'

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
    <main className="min-h-screen bg-[#0A0F1E] text-[#EEF4FF]">
      {/* Header */}
      <div className="border-b border-[#1E3050] bg-[#0A0F1E]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-outfit text-[#00E8FF]">Nota MEI</span>
            <span className="text-xs bg-[#00E8FF]/10 text-[#00E8FF] border border-[#00E8FF]/20 rounded-full px-2 py-0.5">
              Sandbox
            </span>
          </div>
          <a
            href="https://notameigateway.com.br"
            className="text-sm text-[#8AA0B8] hover:text-[#EEF4FF] transition-colors"
          >
            Criar conta grátis →
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold font-outfit">
            Teste a API em{' '}
            <span className="text-[#00E8FF]">30 segundos</span>
          </h1>
          <p className="text-[#8AA0B8] text-lg max-w-xl mx-auto">
            Ambiente sandbox público. Nenhuma NFS-e é enviada à Receita Federal — todas as
            respostas são simuladas com dados realistas.
          </p>
        </div>

        {/* Demo Key */}
        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-6 space-y-3">
          <p className="text-sm text-[#8AA0B8] font-medium uppercase tracking-wider">
            Chave de demonstração (sem cadastro)
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#0A0F1E] border border-[#1E3050] rounded-lg px-4 py-3 text-[#00E8FF] font-mono text-sm">
              {DEMO_KEY}
            </code>
            <button
              onClick={copyKey}
              className="px-4 py-3 bg-[#00E8FF]/10 hover:bg-[#00E8FF]/20 border border-[#00E8FF]/30 text-[#00E8FF] rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {copied ? '✓ Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-[#6473A0]">
            Limite: 20 requisições/hora por IP · Dados resetam a cada reinício do servidor
          </p>
        </div>

        {/* Quick Run */}
        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Emitir nota agora</h2>
            <div className="flex gap-2">
              {notaId && (
                <button
                  onClick={fetchNota}
                  disabled={loading}
                  className="px-4 py-2 bg-[#1E3050] hover:bg-[#2a4060] border border-[#1E3050] rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  Consultar nota
                </button>
              )}
              <button
                onClick={runDemo}
                disabled={loading}
                className="px-5 py-2 bg-[#00E8FF] hover:bg-[#00C8DF] text-[#0A0F1E] font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? 'Aguardando…' : '▶ Executar'}
              </button>
            </div>
          </div>

          {response && (
            <pre className="bg-[#0A0F1E] border border-[#1E3050] rounded-lg p-4 text-sm font-mono text-[#00E8FF] overflow-x-auto whitespace-pre-wrap">
              {response}
            </pre>
          )}
        </div>

        {/* Code Snippets */}
        <div className="bg-[#142035] border border-[#1E3050] rounded-xl overflow-hidden">
          <div className="flex border-b border-[#1E3050]">
            {(['curl', 'node', 'python'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-[#00E8FF] border-b-2 border-[#00E8FF] bg-[#00E8FF]/5'
                    : 'text-[#8AA0B8] hover:text-[#EEF4FF]'
                }`}
              >
                {tab === 'curl' ? 'cURL' : tab === 'node' ? 'Node.js' : 'Python'}
              </button>
            ))}
          </div>
          <pre className="p-6 text-sm font-mono text-[#8AA0B8] overflow-x-auto whitespace-pre leading-relaxed">
            <code>{snippets[activeTab]}</code>
          </pre>
        </div>

        {/* Webhook Monitor */}
        <div className="bg-[#142035] border border-[#1E3050] rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">Webhook de teste</h2>
            <p className="text-sm text-[#8AA0B8] mt-1">
              Use esta URL no campo <code className="text-[#00E8FF]">webhook_url</code> para
              receber callbacks simulados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#0A0F1E] border border-[#1E3050] rounded-lg px-4 py-3 text-[#00E8FF] font-mono text-sm break-all">
              {SANDBOX_WEBHOOK}
            </code>
          </div>
          <p className="text-xs text-[#6473A0]">
            Os últimos 20 payloads recebidos ficam disponíveis em{' '}
            <code className="text-[#8AA0B8]">GET {SANDBOX_WEBHOOK}</code>
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
              className="bg-[#142035] border border-[#1E3050] rounded-xl p-4 text-center"
            >
              <p className="text-2xl font-bold font-outfit text-[#00E8FF]">{item.value}</p>
              <p className="text-sm text-[#8AA0B8] mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 py-8">
          <p className="text-[#8AA0B8]">Pronto para emitir notas reais?</p>
          <a
            href="https://notameigateway.com.br/cadastro"
            className="inline-block px-8 py-3 bg-[#00E8FF] hover:bg-[#00C8DF] text-[#0A0F1E] font-bold rounded-xl transition-colors"
          >
            Criar conta grátis →
          </a>
        </div>
      </div>
    </main>
  )
}
