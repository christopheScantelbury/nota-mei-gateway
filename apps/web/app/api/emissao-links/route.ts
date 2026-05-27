import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveEmpresaId } from '@/lib/empresa'
import { generateAPIKey, generateLinkToken } from '@/lib/api-key-utils'

interface CreateLinkInput {
  template_id?:    string
  recorrencia_id?: string
  nome:            string
}

// GET /api/emissao-links — lista links ativos da empresa
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('emissao_links')
    .select('id, token, nome, template_id, recorrencia_id, usos, ultima_emissao_em, ultima_nota_id, ativo, revogado_em, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[emissao-links GET]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }
  return NextResponse.json({ links: data ?? [] })
}

// POST /api/emissao-links — cria novo link
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const empresaId = await getActiveEmpresaId(supabase, session.user.id)
  if (!empresaId) {
    return NextResponse.json({ error: 'NO_EMPRESA', message: 'Empresa ativa não resolvida' }, { status: 400 })
  }

  let body: Partial<CreateLinkInput>
  try { body = await request.json() } catch { body = {} }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Nome do link é obrigatório' }, { status: 422 })
  }
  const hasTemplate    = !!body.template_id
  const hasRecorrencia = !!body.recorrencia_id
  if (hasTemplate === hasRecorrencia) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Informe template_id OU recorrencia_id (exatamente um)' }, { status: 422 })
  }

  // Verifica que a origem pertence à empresa (RLS já enforça, mas dá erro claro)
  if (hasTemplate) {
    const { data: tpl } = await supabase
      .from('nota_templates')
      .select('id')
      .eq('id', body.template_id!)
      .maybeSingle()
    if (!tpl) return NextResponse.json({ error: 'NOT_FOUND', message: 'Template não encontrado' }, { status: 404 })
  } else {
    const { data: rec } = await supabase
      .from('nota_recorrencias')
      .select('id')
      .eq('id', body.recorrencia_id!)
      .maybeSingle()
    if (!rec) return NextResponse.json({ error: 'NOT_FOUND', message: 'Automação não encontrada' }, { status: 404 })
  }

  // Gera API key interna + token do link
  const { plain, hash, prefix } = await generateAPIKey('live')
  const token = generateLinkToken()

  // Insere api_key com label identificando origem
  const { data: keyRow, error: keyErr } = await supabase
    .from('api_keys')
    .insert({
      empresa_id: empresaId,
      key_hash:   hash,
      key_prefix: prefix,
      label:      `Link rápido: ${body.nome.trim().slice(0, 80)}`,
    })
    .select('id')
    .single<{ id: string }>()

  if (keyErr || !keyRow) {
    console.error('[emissao-links POST] api_key err', keyErr)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Falha ao criar API key interna' }, { status: 500 })
  }

  // Insere o link
  const { data: linkRow, error: linkErr } = await supabase
    .from('emissao_links')
    .insert({
      empresa_id:          empresaId,
      template_id:         body.template_id ?? null,
      recorrencia_id:      body.recorrencia_id ?? null,
      token,
      nome:                body.nome.trim(),
      internal_api_key:    plain,
      internal_api_key_id: keyRow.id,
    })
    .select('id, token, nome, template_id, recorrencia_id, usos, ativo, created_at')
    .single()

  if (linkErr || !linkRow) {
    // Rollback da api_key (best effort)
    await supabase.from('api_keys').delete().eq('id', keyRow.id)
    console.error('[emissao-links POST] link err', linkErr)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: linkErr?.message ?? 'Falha ao criar link' }, { status: 500 })
  }

  return NextResponse.json(linkRow, { status: 201 })
}
