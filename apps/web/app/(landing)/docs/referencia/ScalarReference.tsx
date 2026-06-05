'use client'

// ScalarReference — embed da Scalar API Reference UI dentro do DocsLayout.
// Antes era um <route handler> que servia HTML standalone (fora do layout).
// Agora roda como client component:
// 1. Cria <script id="api-reference" data-url="/openapi.yaml" data-config="..."/>
// 2. Injeta o SDK Scalar do CDN (defer load)
// 3. Cleanup ao desmontar
//
// CustomCss usa os tokens do design system v2 (brand-blue, navy-*, text-*)
// — light theme nasce com fundo branco; dark herda navy-900 do app.

import { useEffect, useRef } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.emitirnotafacil.com.br'
const SANDBOX_URL = 'https://sandbox.emitirnotafacil.com.br'

const SERVERS = [
  { url: API_URL, description: 'Produção' },
  { url: SANDBOX_URL, description: 'Sandbox' },
  { url: 'http://localhost:8080', description: 'Local' },
]

// CSS custom — usa tokens via CSS vars do design system (carregadas no
// globals.css). Cobre light e dark automaticamente.
const CUSTOM_CSS = `
  .scalar-app, .scalar-api-reference {
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  :root {
    --scalar-color-1: rgb(15 23 42);
    --scalar-color-2: rgb(100 116 139);
    --scalar-color-3: rgb(148 163 184);
    --scalar-color-accent: rgb(59 130 246);
    --scalar-background-1: rgb(255 255 255);
    --scalar-background-2: rgb(248 250 252);
    --scalar-background-3: rgb(241 245 249);
    --scalar-background-accent: rgb(239 246 255);
    --scalar-border-color: rgb(226 232 240);
    --scalar-radius: 12px;
    --scalar-radius-lg: 16px;
  }
  .dark {
    --scalar-color-1: rgb(248 250 252);
    --scalar-color-2: rgb(148 163 184);
    --scalar-color-3: rgb(100 116 139);
    --scalar-color-accent: rgb(96 165 250);
    --scalar-background-1: rgb(15 23 42);
    --scalar-background-2: rgb(30 41 59);
    --scalar-background-3: rgb(51 65 85);
    --scalar-background-accent: rgb(30 58 138 / 0.3);
    --scalar-border-color: rgb(51 65 85);
  }
`

export default function ScalarReference() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 1. Inject <script id="api-reference" data-...> que Scalar lê
    const scriptElement = document.createElement('script')
    scriptElement.id = 'api-reference'
    scriptElement.setAttribute('data-url', '/openapi.yaml')
    scriptElement.setAttribute(
      'data-configuration',
      JSON.stringify({
        theme: 'default',
        layout: 'modern',
        defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
        servers: SERVERS,
        customCss: CUSTOM_CSS,
        hideDarkModeToggle: true, // herdamos do ThemeToggle do site
        hideClientButton: false,
      }),
    )
    container.appendChild(scriptElement)

    // 2. Inject Scalar SDK do CDN
    const cdnScript = document.createElement('script')
    cdnScript.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'
    cdnScript.async = true
    document.body.appendChild(cdnScript)

    // 3. Cleanup
    return () => {
      try {
        scriptElement.remove()
        cdnScript.remove()
        // Scalar injeta DOM dentro do <body> diretamente em algumas versões
        document
          .querySelectorAll('.scalar-api-reference, .scalar-app')
          .forEach((el) => el.remove())
      } catch {
        /* noop */
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="min-h-[80vh] bg-white dark:bg-navy-900">
      {/* Scalar renderiza dentro deste container (ou faz append no body
          dependendo da versão). Placeholder até carregar. */}
      <div className="px-6 py-12 text-center text-text-2 text-sm">
        Carregando referência interativa…
      </div>
    </div>
  )
}
