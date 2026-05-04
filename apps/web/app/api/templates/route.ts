import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface NotaTemplate {
  id: string
  mei_id: string
  nome: string
  descricao: string | null
  servico: {
    codigo_nbs: string
    discriminacao: string
    valor: number
    aliquota_iss: number
  }
  tomador: {
    tipo: 'PJ' | 'PF'
    documento: string
    razao_social: string
    email: string
    municipio_ibge: string
  } | null
  webhook_url: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

/** GET /api/templates — list active templates for the authenticated MEI */
export async function GET() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('nota_templates')
    .select('*')
    .eq('mei_id', session.user.id)
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .returns<NotaTemplate[]>()

  if (error) {
    console.error('templates GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ templates: data ?? [] })
}

/** POST /api/templates — create a new template */
export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<NotaTemplate>

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 422 })
  }
  if (!body.servico?.codigo_nbs || !body.servico?.discriminacao) {
    return NextResponse.json({ error: 'Dados de serviço incompletos' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('nota_templates')
    .insert({
      mei_id:      session.user.id,
      nome:        body.nome.trim(),
      descricao:   body.descricao?.trim() || null,
      servico:     body.servico,
      tomador:     body.tomador ?? null,
      webhook_url: body.webhook_url?.trim() || null,
    })
    .select('*')
    .single<NotaTemplate>()

  if (error) {
    console.error('templates POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ template: data }, { status: 201 })
}
