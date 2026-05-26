import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCNPJ, extractCNAEs } from '@/lib/brasilapi'

// GET /api/nbs/buscar?q=<termo>
//
// Busca serviços (códigos NBS) pelo nome/código aplicando dois filtros:
//   1. ctrib_nac_valido = true   (existe na lista oficial LC116 da Receita)
//   2. ctrib_nac está mapeado p/ algum CNAE registrado no CNPJ do usuário
//
// Lazy-load dos CNAEs: se a empresa/MEI ainda não tem `cnaes` populados,
// consulta BrasilAPI e persiste. Falha silenciosa em qualquer ponto — neste
// caso volta ao filtro antigo (permitido_mei por categoria).

interface NBSResult { codigo: string; descricao: string; ctrib_nac: string }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  // ?all=1 → lista completa dos serviços disponíveis (até 200), sem precisar
  // de termo de busca. Útil quando o user não sabe que palavra digitar.
  const showAll = request.nextUrl.searchParams.get('all') === '1'
  if (!showAll && q.length < 2) return NextResponse.json({ results: [] })

  // ── Carrega contexto da empresa/MEI ─────────────────────────────────────
  const ctx = await loadOwnerContext(supabase, user.id)

  // ── Lazy-load de CNAEs via BrasilAPI ────────────────────────────────────
  let cnaes = ctx.cnaes
  if (cnaes.length === 0 && ctx.cnpj) {
    const fetched = await fetchAndPersistCNAEs(supabase, ctx)
    if (fetched) cnaes = fetched
  }

  // ── Monta query base ────────────────────────────────────────────────────
  const digits = q.replace(/\D/g, '')
  let query = supabase
    .from('codigos_nbs')
    .select('codigo, descricao, ctrib_nac')
    .eq('ctrib_nac_valido', true)

  if (!showAll) {
    if (digits.length >= 2 && digits.length === q.replace(/[.\s]/g, '').length) {
      query = query.ilike('codigo', `${digits}%`)
    } else {
      query = query.ilike('descricao', `%${q}%`)
    }
  }

  // Filtro por categoria (MEI vs ME/EPP) sempre aplicado — refinamento por CNAE depois.
  if (ctx.isMei) query = query.eq('permitido_mei', true)

  // ── Filtro por CNAE (se temos cnaes do CNPJ) ────────────────────────────
  if (cnaes.length > 0) {
    const { data: mapping } = await supabase
      .from('cnae_ctribnac')
      .select('ctrib_nac')
      .in('cnae_codigo', cnaes)
      .returns<{ ctrib_nac: string }[]>()

    const allowedCtribs = Array.from(new Set((mapping ?? []).map(m => m.ctrib_nac)))
    if (allowedCtribs.length > 0) {
      query = query.in('ctrib_nac', allowedCtribs)
    }
    // Se nenhum CNAE do CNPJ está no nosso mapping (provável CNAE não-curado),
    // mantém só o filtro de categoria — UI vai mostrar resultado normal.
  }

  const { data, error } = await query
    .order('descricao', { ascending: true })
    .limit(showAll ? 200 : 15)
    .returns<NBSResult[]>()

  if (error) {
    return NextResponse.json({ error: 'QUERY_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    results: data ?? [],
    categoria: ctx.isMei ? 'MEI' : 'ME',
    cnaes_aplicados: cnaes,
    filtrado_por_cnpj: cnaes.length > 0,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface OwnerCtx {
  table: 'empresas' | 'meis'
  ownerId: string
  cnpj: string | null
  cnaes: string[]
  isMei: boolean
}

async function loadOwnerContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<OwnerCtx> {
  // empresas primeiro (modelo novo)
  const { data: emp } = await supabase
    .from('empresas')
    .select('id, cnpj, tipo, cnaes')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; cnpj: string; tipo: string; cnaes: string[] | null }>()

  if (emp) {
    return {
      table: 'empresas',
      ownerId: emp.id,
      cnpj: emp.cnpj,
      cnaes: Array.isArray(emp.cnaes) ? emp.cnaes : [],
      isMei: (emp.tipo ?? 'MEI') === 'MEI',
    }
  }

  // fallback meis (legacy)
  const { data: mei } = await supabase
    .from('meis')
    .select('id, cnpj, cnaes')
    .eq('id', userId)
    .maybeSingle<{ id: string; cnpj: string; cnaes: string[] | null }>()

  if (mei) {
    return {
      table: 'meis',
      ownerId: mei.id,
      cnpj: mei.cnpj,
      cnaes: Array.isArray(mei.cnaes) ? mei.cnaes : [],
      isMei: true,
    }
  }

  return { table: 'empresas', ownerId: userId, cnpj: null, cnaes: [], isMei: true }
}

async function fetchAndPersistCNAEs(
  supabase: ReturnType<typeof createClient>,
  ctx: OwnerCtx,
): Promise<string[] | null> {
  if (!ctx.cnpj) return null
  const payload = await fetchCNPJ(ctx.cnpj)
  if (!payload) return null

  const cnaes = extractCNAEs(payload)
  if (cnaes.length === 0) return null

  // Persiste fire-and-forget — se falhar (RLS, race), só ignora e usa em memória.
  await supabase
    .from(ctx.table)
    .update({ cnaes })
    .eq(ctx.table === 'empresas' ? 'user_id' : 'id', ctx.ownerId)

  return cnaes
}
