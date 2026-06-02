'use client'

import { useState } from 'react'

/**
 * Snippet curl com botão "Copiar" exibido logo abaixo do hero do /gateway.
 *
 * Spec: HIST-3.3 + 03-Copies-Finais.md seção "Hero do /gateway".
 *
 * Fallback de clipboard usa document.execCommand pra browsers que ainda
 * não expõem navigator.clipboard (raros, mas evita quebra).
 */
const SNIPPET = `curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \\
  -H "Authorization: Bearer $NF_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d @nota.json`

export default function GatewayCurlSnippet() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(SNIPPET)
      } else {
        // Fallback legado
        const ta = document.createElement('textarea')
        ta.value = SNIPPET
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {/* ignore */}
  }

  return (
    <div className="mt-8 max-w-2xl">
      <div className="relative rounded-xl border border-navy-600 bg-navy-900 overflow-hidden">
        <pre className="text-slate-100 p-4 text-xs sm:text-sm overflow-x-auto whitespace-pre leading-relaxed">
          <code>{SNIPPET}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 text-xs bg-navy-700 hover:bg-navy-600 border border-navy-500 text-text-1 px-3 py-1 rounded-md transition"
        >
          {copied ? '✓ Copiado' : '📋 Copiar'}
        </button>
      </div>
      <p className="text-text-2 text-xs mt-2 ml-1">
        3 linhas. Sem SOAP, sem XSD. JSON + Bearer.
      </p>
    </div>
  )
}
