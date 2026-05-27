import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveEmpresaId } from '@/lib/empresa'
import { validateClienteInput, normalizeClienteInput } from '@/lib/clientes-validation'
import type { Cliente, ClienteInput } from '@/lib/types-cliente'

// ── GET /api/clientes ?q=&tag=&ativo=&page=&limit= ──

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const q     = sp.get('q')?.trim() || ''
  const tag   = sp.get('tag')?.trim() || ''
  const ativo = sp.get('ativo') === 'false' ? false : true
  const page  = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20', 10)))
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' })
    .eq('ativo', ativo)
    .order('ultima_emissao_em', { ascending: false, nullsFirst: false })
    .order('razao_social', { ascending: true })
    .range(from, to)

  if (q) {
    // busca por razao_social, nome_fantasia ou documento
    const isNumeric = /^\d+$/.test(q.replace(/\D/g, ''))
    if (isNumeric) {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,documento.ilike.%${q.replace(/\D/g, '')}%`)
    } else {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`)
    }
  }
  if (tag) {
    query = query.contains('tags', [tag])
  }

  const { data, error, count } = await query.returns<Cliente[]>()
  if (error) {
    console.error('[clientes GET]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    clientes: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}

// ── POST /api/clientes ──

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const empresaId = await getActiveEmpresaId(supabase, session.user.id)
  if (!empresaId) {
    return NextResponse.json({ error: 'NO_EMPRESA', message: 'Empresa ativa não resolvida' }, { status: 400 })
  }

  let body: Partial<ClienteInput>
  try { body = await request.json() } catch { body = {} }

  // Campos obrigatórios
  if (!body.tipo)         return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'tipo é obrigatório' }, { status: 422 })
  if (!body.documento)    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'documento é obrigatório' }, { status: 422 })
  if (!body.razao_social) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'razao_social é obrigatório' }, { status: 422 })

  const err = validateClienteInput(body)
  if (err) return NextResponse.json({ error: 'VALIDATION_ERROR', message: err }, { status: 422 })

  const insert = {
    empresa_id: empresaId,
    ...normalizeClienteInput(body),
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert(insert)
    .select('*')
    .single<Cliente>()

  if (error) {
    // Detecta duplicate key (cliente com mesmo documento já existe ativo)
    if (error.code === '23505') {
      // Procura o existente pra devolver junto
      const { data: existing } = await supabase
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('documento', String(body.documento).replace(/\D/g, ''))
        .eq('ativo', true)
        .maybeSingle<Cliente>()
      return NextResponse.json(
        { error: 'ALREADY_EXISTS', message: 'Cliente com este documento já cadastrado', cliente: existing },
        { status: 409 },
      )
    }
    console.error('[clientes POST]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ cliente: data }, { status: 201 })
}

