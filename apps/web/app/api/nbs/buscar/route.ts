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

  // ── Filtro por CNAE ────────────────────────────────────────────────────
  // Regra (estrita):
  //   1. Tem CNAE conhecido → filtra APENAS pelos ctribs mapeados (sem
  //      auto-incluir kit universal). É o que o usuário pediu: "se meu CNAE
  //      é tech, não me mostre Acupuntura".
  //   2. CNAE conhecido mas sem mapping no banco → fallback pra kit universal
  //      (6 ctribs coringa) pra não deixar o usuário sem nenhuma opção.
  //   3. Nenhum CNAE conhecido → sem filtro (UI mostra catálogo completo).
  //   4. ignoreCnae=1 → bypass explícito do usuário (botão "Ver todos").
  let cnaeCtribs: string[] = []
  let usouFallbackUniversal = false

  if (!ignoreCnae && cnaes.length > 0) {
    const { data: cnaeMapping } = await supabase
      .from('cnae_ctribnac')
      .select('ctrib_nac')
      .in('cnae_codigo', cnaes)
      .returns<{ ctrib_nac: string }[]>()

    cnaeCtribs = Array.from(new Set((cnaeMapping ?? []).map(m => m.ctrib_nac)))

    if (cnaeCtribs.length > 0) {
      // Caminho normal: filtra ESTRITAMENTE pelos ctribs do CNAE
      query = query.in('ctrib_nac', cnaeCtribs)
    } else {
      // CNAE não mapeado no nosso banco → cai pro kit universal
      const { data: kit } = await supabase
        .from('cnae_ctribnac')
        .select('ctrib_nac')
        .eq('cnae_codigo', '0000000')
        .returns<{ ctrib_nac: string }[]>()
      const universalCtribs = Array.from(new Set((kit ?? []).map(m => m.ctrib_nac)))
      if (universalCtribs.length > 0) {
        query = query.in('ctrib_nac', universalCtribs)
        cnaeCtribs = universalCtribs
        usouFallbackUniversal = true
      }
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

  const results = data ?? []
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
    fallback_universal: usouFallbackUniversal,
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
  // empresas primeiro (modelo novo). Inclui também o `cnae` legado pra fallback
  // — se o array `cnaes` estiver vazio (lazy-load nunca rodou ou falhou), pelo
  // menos garante 1 CNAE conhecido pra aplicar filtro.
  const { data: emp } = await supabase
    .from('empresas')
    .select('id, cnpj, tipo, cnae, cnaes')
    .eq('user_id', userId)
    .maybeSingle<{ id: string; cnpj: string; tipo: string; cnae: string | null; cnaes: string[] | null }>()

  if (emp) {
    const cnaesArr = Array.isArray(emp.cnaes) ? emp.cnaes.filter(c => /^\d{7}$/.test(c)) : []
    const fallbackCnae = emp.cnae && /^\d{7}$/.test(emp.cnae) ? [emp.cnae] : []
    return {
      table: 'empresas',
      ownerId: emp.id,
      cnpj: emp.cnpj,
      cnaes: cnaesArr.length > 0 ? cnaesArr : fallbackCnae,
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
      cnaes: Array.isArray(mei.cnaes) ? mei.cnaes.filter(c => /^\d{7}$/.test(c)) : [],
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
