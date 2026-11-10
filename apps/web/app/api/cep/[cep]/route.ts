import { NextResponse } from 'next/server'
import { consultarCep, type CepResult } from '@/lib/cep'

export type { CepResult }

/**
 * GET /api/cep/{cep} → { localidade, uf, ibge, ... }
 *   404 CEP_NAO_ENCONTRADO — o CEP não existe;
 *   502 CEP_INDISPONIVEL   — ViaCEP e BrasilAPI fora do ar: tente de novo.
 * ViaCEP com fallback BrasilAPI (#280).
 */
export async function GET(
  _req: Request,
  { params }: { params: { cep: string } },
) {
  const digits = params.cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    return NextResponse.json(
      { error: 'CEP_INVALIDO', message: 'CEP deve ter exatamente 8 dígitos' },
      { status: 400 },
    )
  }

  const r = await consultarCep(digits)
  if (r.tipo === 'ok') {
    return NextResponse.json(r.dados, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  }
  if (r.tipo === 'nao_encontrado') {
    return NextResponse.json(
      { error: 'CEP_NAO_ENCONTRADO', message: 'CEP não encontrado' },
      { status: 404, headers: { 'Cache-Control': 'public, max-age=600' } },
    )
  }
  return NextResponse.json(
    { error: 'CEP_INDISPONIVEL', message: 'A consulta de CEP está instável no momento. Tente novamente em instantes ou busque o município pelo nome.' },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  )
}
