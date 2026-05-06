import { NextResponse } from 'next/server'

// Cache por 24 h — a lista de municípios do IBGE muda raramente
export const revalidate = 86400

/**
 * Proxy da API do IBGE para evitar problemas de CORS e timeouts no cliente.
 * GET /api/municipios → retorna todos os municípios brasileiros ordenados por nome.
 */
export async function GET() {
  try {
    const res = await fetch(
      'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome',
      {
        next: { revalidate: 86400 },
        headers: { Accept: 'application/json' },
      },
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Falha ao carregar municípios' },
        { status: 502 },
      )
    }

    const data = await res.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao conectar com a API do IBGE' },
      { status: 502 },
    )
  }
}
