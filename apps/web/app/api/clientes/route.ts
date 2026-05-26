import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveEmpresaId } from '@/lib/empresa'
import type { Cliente, ClienteInput } from '@/lib/types-cliente'

// ── Validação leve (não bloqueia a maioria das edições) ──

function validateInput(input: Partial<ClienteInput>): string | null {
  if (input.tipo && !['PJ', 'PF'].includes(input.tipo)) return 'tipo inválido (use PJ ou PF)'
  if (input.documento != null) {
    const clean = String(input.documento).replace(/\D/g, '')
    if (input.tipo === 'PJ' && clean.length !== 14) return 'CNPJ deve ter 14 dígitos'
    if (input.tipo === 'PF' && clean.length !== 11) return 'CPF deve ter 11 dígitos'
    if (!input.tipo && clean.length !== 11 && clean.length !== 14) return 'documento inválido'
  }
  if (input.razao_social != null && String(input.razao_social).trim().length === 0) {
    return 'razao_social é obrigatória'
  }
  if (input.email != null && input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return 'email inválido'
  }
  if (input.municipio_ibge != null && input.municipio_ibge) {
    if (!/^\d{7}$/.test(input.municipio_ibge)) return 'municipio_ibge deve ter 7 dígitos'
  }
  return null
}

function normalize(input: Partial<ClienteInput>) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    if (k === 'documento' && typeof v === 'string') {
      out[k] = v.replace(/\D/g, '')
    } else if (k === 'tags' && Array.isArray(v)) {
      out[k] = v.map(String).map((s) => s.trim()).filter(Boolean)
    } else if (typeof v === 'string') {
      const trimmed = v.trim()
      out[k] = trimmed === '' ? null : trimmed
    } else {
      out[k] = v
    }
  }
  return out
}

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

  const err = validateInput(body)
  if (err) return NextResponse.json({ error: 'VALIDATION_ERROR', message: err }, { status: 422 })

  const insert = {
    empresa_id: empresaId,
    ...normalize(body),
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

// ── Export para reuse em [id]/route.ts ──
export { validateInput, normalize }
