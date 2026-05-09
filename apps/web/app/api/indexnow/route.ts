import { NextResponse } from 'next/server'
import { BLOG_POSTS } from '@/lib/blog/manifest'

// IndexNow — protocolo aberto (Bing, Yandex, Naver, Seznam) para
// notificar buscadores quando URLs mudam. Resultado: indexação em
// minutos em vez de dias.
//
// Google ainda não suporta oficialmente — para Google, usar Search
// Console manualmente OU Google Indexing API (precisa job posting).
//
// Como rodar manualmente após cada deploy importante:
//   curl -X POST https://emitirnotafacil.com.br/api/indexnow
//
// Para automatizar, adicionar ao GitHub Action de deploy.

const HOST    = 'emitirnotafacil.com.br'
const KEY     = '1118c75ce7434ba5a4aaac4402a91b38'
const KEY_URL = `https://${HOST}/${KEY}.txt`

const STATIC_URLS = [
  '',
  '/mei',
  '/me',
  '/gateway',
  '/precos',
  '/blog',
  '/cadastro',
  '/login',
  '/docs',
  '/docs/quickstart',
  '/sandbox',
  '/status',
  '/certificado-a1',
  '/obrigatoriedade-nfse-mei',
]

export async function POST() {
  const blogUrls = BLOG_POSTS.map((p) => `/blog/${p.slug}`)
  const urls = [...STATIC_URLS, ...blogUrls].map((p) => `https://${HOST}${p}`)

  const payload = {
    host:        HOST,
    key:         KEY,
    keyLocation: KEY_URL,
    urlList:     urls,
  }

  const results: Record<string, { status: number; ok: boolean }> = {}

  for (const endpoint of [
    'https://api.indexnow.org/indexnow',  // agregador (cobre Bing + Yandex + Seznam)
  ]) {
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      results[endpoint] = { status: res.status, ok: res.ok }
    } catch (e: unknown) {
      results[endpoint] = { status: 0, ok: false }
    }
  }

  return NextResponse.json({
    submitted: urls.length,
    urls,
    results,
  })
}

export async function GET() {
  return NextResponse.json({
    message: 'POST nesse endpoint para submeter todas as URLs ao IndexNow.',
    keyUrl:  KEY_URL,
  })
}
