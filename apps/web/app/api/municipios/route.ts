import { NextResponse } from 'next/server'

// ISR: revalida a cada 24 h — a lista de municípios do IBGE muda raramente
export const revalidate = 86400

const IBGE_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'

// Estrutura aninhada retornada pelo IBGE (usada apenas aqui no servidor)
interface IbgeRaw {
  id: number
  nome: string
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } }
}

// Estrutura simplificada devolvida ao cliente
export interface MunicipioSimples {
  id: number
  nome: string
  uf: string
}

/**
 * Proxy da API do IBGE para evitar problemas de CORS e timeouts no cliente.
 * GET /api/municipios → retorna array simplificado { id, nome, uf }[].
 *
 * A transformação ocorre aqui no servidor para que o cliente nunca precise
 * navegar a cadeia aninhada microrregiao.mesorregiao.UF.sigla, que é
 * undefined em alguns territórios especiais do IBGE e causava TypeError
 * no cliente, ativando o modo de erro mesmo com HTTP 200 válido.
 *
 * Estratégia de resiliência:
 * - AbortController com timeout de 8 s por tentativa
 * - Até 3 tentativas com back-off simples (0 s, 1 s, 2 s)
 * - Resposta cacheada por 24 h no CDN (Cache-Control + revalidate)
 */
async function fetchWithRetry(url: string, maxAttempts = 3): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, attempt * 1000))
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8_000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: 86400 },
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeoutId)
      if (res.ok) return res
      lastError = new Error(`IBGE HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timeoutId)
      lastError = err
    }
  }
  throw lastError
}

export async function GET() {
  try {
    const res = await fetchWithRetry(IBGE_URL)
    const raw: unknown = await res.json()

    // Transforma server-side: o cliente recebe apenas { id, nome, uf }[]
    const data: IbgeRaw[] = Array.isArray(raw) ? (raw as IbgeRaw[]) : []
    const municipios: MunicipioSimples[] = data
      .map((m) => ({
        id: m.id,
        nome: m.nome ?? '',
        uf: m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
      }))
      .filter((m) => m.nome && m.uf)

    return NextResponse.json(municipios, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Falha ao carregar municípios' },
      { status: 502 },
    )
  }
}
