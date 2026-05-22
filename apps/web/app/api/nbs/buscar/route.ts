import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/nbs/buscar?q=<termo>
// Busca serviços (códigos NBS) pelo NOME/descrição. Filtra por categoria da
// empresa: MEI vê apenas serviços permitidos (permitido_mei = true); ME/EPP vê
// todos. Consulta a tabela codigos_nbs direto no Supabase (RLS: leitura pública).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Descobre a categoria da empresa para decidir o filtro permitido_mei.
  const { data: empresa } = await supabase
    .from('empresas')
    .select('tipo')
    .eq('id', user.id)
    .maybeSingle<{ tipo: string }>()

  const isMei = (empresa?.tipo ?? 'MEI') === 'MEI'

  // Busca por descrição (ILIKE) ou por código (dígitos).
  const digits = q.replace(/\D/g, '')
  let query = supabase
    .from('codigos_nbs')
    .select('codigo, descricao')

  if (digits.length >= 2 && digits.length === q.replace(/[.\s]/g, '').length) {
    // termo é majoritariamente numérico → busca por código
    query = query.ilike('codigo', `${digits}%`)
  } else {
    query = query.ilike('descricao', `%${q}%`)
  }

  if (isMei) {
    query = query.eq('permitido_mei', true)
  }

  const { data, error } = await query
    .order('descricao', { ascending: true })
    .limit(15)
    .returns<{ codigo: string; descricao: string }[]>()

  if (error) {
    return NextResponse.json({ error: 'QUERY_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ results: data ?? [], categoria: empresa?.tipo ?? 'MEI' })
}
