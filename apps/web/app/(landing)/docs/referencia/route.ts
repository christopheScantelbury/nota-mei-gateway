import { NextResponse } from 'next/server'

/**
 * Serves the Scalar API Reference UI for the Nota MEI Gateway OpenAPI spec.
 * Scalar is loaded from CDN — no extra npm package required.
 * The spec is served from /openapi.yaml (copied to public/ at build time).
 */
export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.notameigateway.com.br'
  const sandboxUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://sandbox.notameigateway.com.br'

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Nota MEI Gateway — Referência da API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Documentação interativa da API Nota MEI Gateway" />
    <link rel="preconnect" href="https://fonts.bunny.net" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/openapi.yaml"
      data-configuration='${JSON.stringify({
        theme: 'default',
        darkMode: false,
        layout: 'modern',
        defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
        servers: [
          { url: apiUrl, description: 'Produção' },
          { url: sandboxUrl, description: 'Sandbox' },
          { url: 'http://localhost:8080', description: 'Local' },
        ],
        customCss: `
          :root { --scalar-background-1: #0A0F1E; --scalar-background-2: #142035; --scalar-background-3: #1E3050; --scalar-color-1: #EEF4FF; --scalar-color-2: #8AA0B8; --scalar-color-accent: #00E8FF; }
        `,
      })}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
