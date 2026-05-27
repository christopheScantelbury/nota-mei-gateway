import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RecorrenciaRow } from '../route'

interface PatchInput {
  nome?:                 string
  dia_vencimento?:       number
  proxima_emissao?:      string
  servico?:              Record<string, unknown>
  tomador?:              Record<string, unknown>
  webhook_url?:          string | null
  enviar_email_tomador?: boolean
  email_tomador?:        string | null
  ativo?:                boolean
}

// GET /api/recorrencias/:id
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('nota_recorrencias')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<RecorrenciaRow>()

  if (error) {
    console.error('[recorrencias/:id GET]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json(data)
}

// PUT /api/recorrencias/:id — atualiza
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: PatchInput
  try { body = await req.json() } catch { body = {} }

  // Whitelist + trim de strings vazias → null
  const patch: Record<string, unknown> = {}
  if (body.nome !== undefined)                 patch.nome = body.nome.trim()
  if (body.dia_vencimento !== undefined)       patch.dia_vencimento = body.dia_vencimento
  if (body.proxima_emissao !== undefined)      patch.proxima_emissao = body.proxima_emissao
  if (body.servico !== undefined)              patch.servico = body.servico
  if (body.tomador !== undefined)              patch.tomador = body.tomador
  if (body.webhook_url !== undefined)          patch.webhook_url = body.webhook_url?.trim() || null
  if (body.enviar_email_tomador !== undefined) patch.enviar_email_tomador = body.enviar_email_tomador
  if (body.email_tomador !== undefined)        patch.email_tomador = body.email_tomador?.trim() || null
  if (body.ativo !== undefined)                patch.ativo = body.ativo

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo para atualizar' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('nota_recorrencias')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .maybeSingle<RecorrenciaRow>()

  if (error) {
    console.error('[recorrencias/:id PUT]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json(data)
}

// DELETE /api/recorrencias/:id
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { error, count } = await supabase
    .from('nota_recorrencias')
    .delete({ count: 'exact' })
    .eq('id', params.id)

  if (error) {
    console.error('[recorrencias/:id DELETE]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (count === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
