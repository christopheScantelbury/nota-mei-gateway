import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NotaTemplate } from '../route'

/** PUT /api/templates/:id — update a template */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<NotaTemplate>

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('nota_templates')
    .update({
      nome:        body.nome.trim(),
      descricao:   body.descricao?.trim() || null,
      servico:     body.servico,
      tomador:     body.tomador ?? null,
      webhook_url: body.webhook_url?.trim() || null,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('mei_id', session.user.id)  // RLS enforced in DB too, but be explicit
    .select('*')
    .single<NotaTemplate>()

  if (error) {
    console.error('templates PUT error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ template: data })
}

/** DELETE /api/templates/:id — soft-delete (set ativo = false) */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('nota_templates')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('mei_id', session.user.id)

  if (error) {
    console.error('templates DELETE error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
