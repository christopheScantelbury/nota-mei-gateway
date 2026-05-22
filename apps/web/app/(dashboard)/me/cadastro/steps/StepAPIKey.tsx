'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface Props {
  apiKey: string
  empresaId: string
}

export function StepAPIKey({ apiKey, empresaId }: Props) {
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: select the text
      const el = document.getElementById('api-key-display') as HTMLInputElement | null
      el?.select()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-1">API Key gerada</h2>
        <p className="text-sm text-text-2 mt-1">
          Empresa cadastrada com sucesso! Guarde sua API Key agora.
        </p>
      </div>

      {/* One-time warning */}
      <div className="rounded-xl border border-nota-rejeitada/40 bg-nota-rejeitada/10 p-4">
        <div className="flex items-start gap-2">
          <span className="text-nota-rejeitada text-lg mt-0.5">🔑</span>
          <div>
            <p className="font-semibold text-nota-rejeitada text-sm">Exibida apenas uma vez</p>
            <p className="text-text-2 text-sm mt-0.5">
              Esta é a <strong>única vez</strong> que sua API Key será exibida em texto claro.
              Não é possível recuperá-la depois. Guarde-a agora em um gerenciador de senhas seguro.
            </p>
          </div>
        </div>
      </div>

      {/* API Key display */}
      <div>
        <p className="text-sm font-medium text-text-1 mb-2">Sua API Key</p>
        <div className="flex items-stretch gap-2">
          <input
            id="api-key-display"
            type="text"
            readOnly
            value={apiKey}
            className="flex-1 bg-navy-900 border border-navy-600 rounded-lg px-3 py-2.5 text-xs font-mono text-text-1 focus:outline-none focus:border-brand-cyan"
            onFocus={e => e.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`shrink-0 ${copied ? 'bg-nota-autorizada text-navy-900 border-nota-autorizada' : ''}`}
            onClick={copy}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="text-xs text-text-2 mt-1">
          Formato: <span className="font-mono">sk_live_…</span> — use no header{' '}
          <span className="font-mono">Authorization: Bearer sk_live_…</span>
        </p>
      </div>

      {/* Info cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-navy-600 bg-navy-700/50 p-3 text-xs text-text-2">
          <p className="font-semibold text-text-1 mb-1">📚 Documentação</p>
          <p>Consulte os guias de integração e exemplos de código na área de developers.</p>
        </div>
        <div className="rounded-lg border border-navy-600 bg-navy-700/50 p-3 text-xs text-text-2">
          <p className="font-semibold text-text-1 mb-1">⚙️ Mais chaves</p>
          <p>Crie e gerencie múltiplas API Keys em Configurações → API Keys.</p>
        </div>
      </div>

      {/* Confirmation checkbox */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-navy-600 accent-brand-cyan cursor-pointer"
        />
        <span className="text-sm text-text-2">
          Confirmei que salvei a API Key em local seguro. Entendo que não será possível
          recuperá-la depois.
        </span>
      </label>

      {/* CTA */}
      <Link
        href="/notas"
        className={`flex items-center justify-center gap-2 py-3 px-8 rounded-xl font-semibold text-sm transition ${
          confirmed
            ? 'bg-brand-cyan text-navy-900 hover:opacity-90'
            : 'bg-navy-700 text-text-2 cursor-not-allowed pointer-events-none opacity-50'
        }`}
        aria-disabled={!confirmed}
        tabIndex={confirmed ? undefined : -1}
      >
        Acessar painel →
      </Link>

      {!confirmed && (
        <p className="text-xs text-text-2 text-center -mt-4">
          Confirme que guardou a API Key para continuar.
        </p>
      )}
    </div>
  )
}
