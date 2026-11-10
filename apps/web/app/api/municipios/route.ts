import { NextResponse } from 'next/server'
import { municipios, type MunicipioSimples } from '@/lib/municipios'

export type { MunicipioSimples }

// Lista estática (gerada do IBGE por scripts/atualizar-municipios.mjs) — #280.
// O IBGE não responde a partir da Vercel: a rota antiga ficava ~27 s e
// devolvia 502, e o "Buscar pelo nome" do município do tomador não carregava.
export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(municipios(), {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
