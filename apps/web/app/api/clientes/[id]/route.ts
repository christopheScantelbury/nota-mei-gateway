import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateClienteInput, normalizeClienteInput } from '@/lib/clientes-validation'
import type { Cliente, ClienteInput } from '@/lib/types-cliente'

// ── GET /api/clientes/:id — inclui últimas 20 notas ──

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<Cliente>()

  if (error) {
    console.error('[clientes/:id GET]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (!cliente) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Cliente não encontrado' }, { status: 404 })
  }

  const { data: notas } = await supabase
    .from('notas_fiscais')
    .select('id, numero_rps, numero_nfse, status, valor_servico, competencia, emitida_em, created_at')
    .eq('cliente_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ cliente, notas: notas ?? [] })
}

// ── PATCH /api/clientes/:id ──

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: Partial<ClienteInput>
  try { body = await request.json() } catch { body = {} }

  // Nunca permitir alterar empresa_id, id, ou agregados via PATCH
  delete (body as Record<string, unknown>).empresa_id
  delete (body as Record<string, unknown>).id
  delete (body as Record<string, unknown>).total_emitido_brl
  delete (body as Record<string, unknown>).total_notas

  const err = validateClienteInput(body)
  if (err) return NextResponse.json({ error: 'VALIDATION_ERROR', message: err }, { status: 422 })

  const patch = normalizeClienteInput(body)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Nenhum campo para atualizar' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('clientes')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .maybeSingle<Cliente>()

  if (error) {
    console.error('[clientes/:id PATCH]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Cliente não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ cliente: data })
}

// ── DELETE /api/clientes/:id — soft delete (arquivar) ──

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('clientes')
    .update({ ativo: false, arquivado_em: new Date().toISOString() })
    .eq('id', params.id)
    .eq('ativo', true)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[clientes/:id DELETE]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Cliente não encontrado ou já arquivado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
