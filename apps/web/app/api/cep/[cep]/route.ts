import { NextResponse } from 'next/server'

// Cache de 1 h — CEPs raramente mudam; stale-while-revalidate cobre renovações
export const revalidate = 3600

interface ViaCepRaw {
  erro?: boolean | string
  localidade?: string
  uf?: string
  ibge?: string
}

export interface CepResult {
  localidade: string
  uf: string
  ibge: string // código IBGE de 7 dígitos (string, pode ter zero à esquerda)
}

/**
 * Proxy do ViaCEP para evitar CORS e adicionar cache no CDN.
 * GET /api/cep/{cep} → { localidade, uf, ibge } ou 404 se não encontrado.
 */
export async function GET(
  _req: Request,
  { params }: { params: { cep: string } },
) {
  const digits = params.cep.replace(/\D/g, '')

  if (digits.length !== 8) {
    return NextResponse.json(
      { error: 'CEP deve ter exatamente 8 dígitos' },
      { status: 400 },
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6_000)

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })
    }

    const data: ViaCepRaw = await res.json()

    if (data.erro || !data.localidade || !data.ibge) {
      return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 })
    }

    const result: CepResult = {
      localidade: data.localidade,
      uf: data.uf ?? '',
      ibge: data.ibge,
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    clearTimeout(timeoutId)
    return NextResponse.json(
      { error: 'Falha ao consultar ViaCEP. Tente novamente.' },
      { status: 502 },
    )
  }
}
