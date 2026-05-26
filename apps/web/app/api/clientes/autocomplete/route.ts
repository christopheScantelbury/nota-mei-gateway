import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ClienteAutocomplete } from '@/lib/types-cliente'

/**
 * GET /api/clientes/autocomplete?q=...
 *
 * Devolve até 10 clientes ativos que casam com o termo (razao_social, nome_fantasia ou documento).
 * Ordena por `ultima_emissao_em DESC` — clientes recentes aparecem primeiro.
 *
 * Usado pelo combobox em /notas/nova.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const sp = new URL(request.url).searchParams
  const q = sp.get('q')?.trim() ?? ''

  let query = supabase
    .from('clientes')
    .select('id, tipo, documento, razao_social, email, municipio_ibge, total_notas, ultima_emissao_em')
    .eq('ativo', true)
    .order('ultima_emissao_em', { ascending: false, nullsFirst: false })
    .order('razao_social', { ascending: true })
    .limit(10)

  if (q.length > 0) {
    const numeric = q.replace(/\D/g, '')
    if (numeric.length >= 3) {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,documento.ilike.%${numeric}%`)
    } else {
      query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`)
    }
  }

  const { data, error } = await query.returns<ClienteAutocomplete[]>()
  if (error) {
    console.error('[clientes/autocomplete]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ clientes: data ?? [] })
}
