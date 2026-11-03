import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { coletarAchados } from '@/lib/monitor/coletar'

// GET /api/cron/monitor-prod?desde=ISO&ate=ISO
//
// Chamado de hora em hora pelo GitHub Action `monitor-prod.yml`, que transforma
// os achados em issues `bug` + `prod-monitor`. Devolve só dados sanitizados
// (o repo é público). Autorização: Bearer MONITOR_SECRET — obrigatório.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const JANELA_MAX_MS = 7 * 86400_000

function autorizado(req: NextRequest): boolean {
  const secret = process.env.MONITOR_SECRET
  if (!secret) return false
  const recebido = Buffer.from(req.headers.get('authorization') ?? '')
  const esperado = Buffer.from(`Bearer ${secret}`)
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const p = req.nextUrl.searchParams
  const ate = p.get('ate') ? new Date(p.get('ate')!) : new Date()
  const desde = p.get('desde') ? new Date(p.get('desde')!) : new Date(ate.getTime() - 3600_000)
  if (Number.isNaN(ate.getTime()) || Number.isNaN(desde.getTime()) || desde >= ate || ate.getTime() - desde.getTime() > JANELA_MAX_MS) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'janela inválida (máx. 7 dias)' }, { status: 422 })
  }

  const { achados, falhas } = await coletarAchados(createAdminClient(), desde, ate)
  return NextResponse.json({
    janela: { desde: desde.toISOString(), ate: ate.toISOString() },
    achados,
    falhas,
  })
}
