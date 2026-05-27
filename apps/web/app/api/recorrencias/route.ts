import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveEmpresaId } from '@/lib/empresa'
import type { RecorrenciaRow } from '@/lib/types-recorrencia'

interface RecorrenciaInput {
  nome:                  string
  dia_vencimento:        number
  proxima_emissao:       string
  servico:               Record<string, unknown>
  tomador:               Record<string, unknown>
  enviar_email_tomador?: boolean
  email_tomador?:        string | null
  webhook_url?:          string | null
  ativo?:                boolean
}

function validate(body: Partial<RecorrenciaInput>): string | null {
  if (!body.nome?.trim()) return 'nome é obrigatório'
  if (!body.dia_vencimento || body.dia_vencimento < 1 || body.dia_vencimento > 28) {
    return 'dia_vencimento deve estar entre 1 e 28'
  }
  if (!body.proxima_emissao || !/^\d{4}-\d{2}-\d{2}$/.test(body.proxima_emissao)) {
    return 'proxima_emissao inválida (YYYY-MM-DD)'
  }
  const servico = body.servico as Record<string, unknown> | undefined
  if (!servico || !servico.codigo_nbs || !servico.valor) {
    return 'servico.codigo_nbs e servico.valor são obrigatórios'
  }
  const tomador = body.tomador as Record<string, unknown> | undefined
  if (!tomador || !tomador.documento) {
    return 'tomador.documento é obrigatório'
  }
  return null
}

// GET /api/recorrencias — lista automações da empresa ativa
export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data, error } = await supabase
    .from('nota_recorrencias')
    .select('*')
    .order('created_at', { ascending: false })
    .returns<RecorrenciaRow[]>()

  if (error) {
    console.error('[recorrencias GET]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/recorrencias — cria nova automação
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const empresaId = await getActiveEmpresaId(supabase, session.user.id)
  if (!empresaId) {
    return NextResponse.json({ error: 'NO_EMPRESA', message: 'Empresa ativa não resolvida' }, { status: 400 })
  }

  let body: Partial<RecorrenciaInput>
  try { body = await request.json() } catch { body = {} }

  const err = validate(body)
  if (err) return NextResponse.json({ error: 'VALIDATION_ERROR', message: err }, { status: 422 })

  const { data, error } = await supabase
    .from('nota_recorrencias')
    .insert({
      empresa_id:           empresaId,
      mei_id:               session.user.id, // backward-compat (mei_id NOT NULL)
      nome:                 body.nome!.trim(),
      dia_vencimento:       body.dia_vencimento!,
      proxima_emissao:      body.proxima_emissao!,
      servico:              body.servico!,
      tomador:              body.tomador!,
      webhook_url:          body.webhook_url?.trim() || null,
      enviar_email_tomador: body.enviar_email_tomador ?? true,
      email_tomador:        body.email_tomador?.trim() || null,
      ativo:                body.ativo ?? true,
    })
    .select('*')
    .single<RecorrenciaRow>()

  if (error) {
    console.error('[recorrencias POST]', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
