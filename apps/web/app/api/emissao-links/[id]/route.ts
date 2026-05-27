import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/emissao-links/:id — revoga o link + a API key associada
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Busca primeiro pra pegar internal_api_key_id
  const { data: link } = await supabase
    .from('emissao_links')
    .select('id, internal_api_key_id, ativo')
    .eq('id', params.id)
    .maybeSingle<{ id: string; internal_api_key_id: string | null; ativo: boolean }>()

  if (!link) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (!link.ativo) return new NextResponse(null, { status: 204 }) // já revogado

  // Marca link como revogado (soft delete pra preservar histórico)
  const { error: linkErr } = await supabase
    .from('emissao_links')
    .update({ ativo: false, revogado_em: new Date().toISOString() })
    .eq('id', params.id)

  if (linkErr) {
    console.error('[emissao-links DELETE]', linkErr)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: linkErr.message }, { status: 500 })
  }

  // Revoga a API key associada (RLS valida ownership)
  if (link.internal_api_key_id) {
    await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', link.internal_api_key_id)
  }

  return new NextResponse(null, { status: 204 })
}
