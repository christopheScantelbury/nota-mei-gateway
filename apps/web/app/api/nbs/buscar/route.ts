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
  // ?all=1 → modo "listar todos". Devolve uma página de 50 serviços ordenados
  // por relevância (kit universal → CNAE específico → resto). Pra carregar
  // mais use ?offset=N. Performance: ao crescer o catálogo, o cliente paga só
  // o custo da página atual (~5-8KB JSON gzipado).
  const showAll = request.nextUrl.searchParams.get('all') === '1'
  // ?ignoreCnae=1 → ignora o filtro CNAE do CNPJ. Usado quando o usuário tem
  // um CNAE com mapping ruim/inexistente e precisa ver o catálogo amplo.
  const ignoreCnae = request.nextUrl.searchParams.get('ignoreCnae') === '1'
  // Paginação só em modo all (busca por texto continua com LIMIT 15 hard).
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') ?? '0', 10))
  const PAGE_SIZE = 50

  if (!showAll && q.length < 2) {
    return NextResponse.json({ results: [], total: 0, offset: 0, hasMore: false })
  }

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
    .select('codigo, descricao, ctrib_nac', { count: 'exact' })
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

  // ── Filtro por CNAE + kit universal ──
  // Sempre inclui o "kit universal MEI" (cnae_codigo='0000000') — garante que
  // todo usuário sempre vê pelo menos os 6 ctribs coringa, independente do
  // CNAE registrado.
  let universalCtribs: string[] = []
  let cnaeCtribs: string[] = []

  if (!ignoreCnae && cnaes.length > 0) {
    const cnaesComKit = [...cnaes, '0000000']
    const { data: mapping } = await supabase
      .from('cnae_ctribnac')
      .select('cnae_codigo, ctrib_nac')
      .in('cnae_codigo', cnaesComKit)
      .returns<{ cnae_codigo: string; ctrib_nac: string }[]>()

    const map = mapping ?? []
    universalCtribs = Array.from(new Set(map.filter(m => m.cnae_codigo === '0000000').map(m => m.ctrib_nac)))
    cnaeCtribs      = Array.from(new Set(map.filter(m => m.cnae_codigo !== '0000000').map(m => m.ctrib_nac)))

    const allowedCtribs = Array.from(new Set([...universalCtribs, ...cnaeCtribs]))
    if (allowedCtribs.length > 0) {
      query = query.in('ctrib_nac', allowedCtribs)
    }
  }

  // ── Execução: pega total + página ──
  // Faz uma query única com count, paginação e ordering.
  // - Para showAll: ordena por relevância (universal → cnae → resto) via
  //   pós-processamento client-side; a primeira ordenação alfabética garante
  //   estabilidade dentro de cada grupo.
  // - Para search: 15 hits, ordenado por descrição (já é seletivo o suficiente).
  const limit = showAll ? PAGE_SIZE : 15
  const { data, error, count } = await query
    .order('descricao', { ascending: true })
    .range(offset, offset + limit - 1)
    .returns<NBSResult[]>()

  if (error) {
    return NextResponse.json({ error: 'QUERY_ERROR', message: error.message }, { status: 500 })
  }

  // Ordenação por relevância (apenas no showAll — search já é específico)
  let results = data ?? []
  if (showAll && offset === 0 && (universalCtribs.length > 0 || cnaeCtribs.length > 0)) {
    const rank = (r: NBSResult): number => {
      if (universalCtribs.includes(r.ctrib_nac)) return 0  // primeiro
      if (cnaeCtribs.includes(r.ctrib_nac))      return 1  // segundo
      return 2
    }
    results = [...results].sort((a, b) => {
      const diff = rank(a) - rank(b)
      return diff !== 0 ? diff : a.descricao.localeCompare(b.descricao, 'pt-BR')
    })
  }

  const total = count ?? results.length
  const hasMore = showAll && (offset + results.length < total)

  return NextResponse.json({
    results,
    total,
    offset,
    hasMore,
    categoria: ctx.isMei ? 'MEI' : 'ME',
    cnaes_aplicados: cnaes,
    filtrado_por_cnpj: !ignoreCnae && cnaes.length > 0,
    ignorou_cnae: ignoreCnae,
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
