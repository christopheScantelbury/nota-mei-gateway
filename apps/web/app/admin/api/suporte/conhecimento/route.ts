/**
 * Base de conhecimento do atendente de IA.
 * POST  /admin/api/suporte/conhecimento        → cria entrada
 * PATCH /admin/api/suporte/conhecimento?id=…   → edita / ativa / desativa
 *
 * Entra no system prompt da IA na próxima mensagem — sem deploy.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'

const CATEGORIAS = ['correcao', 'limitacao', 'instabilidade', 'procedimento', 'faq'] as const

interface Entrada {
  titulo?: unknown
  conteudo?: unknown
  categoria?: unknown
  ativo?: unknown
  ordem?: unknown
}

function validar(b: Entrada, parcial: boolean): { patch: Record<string, unknown> } | { erro: string } {
  const patch: Record<string, unknown> = {}
  if (b.titulo !== undefined || !parcial) {
    const t = typeof b.titulo === 'string' ? b.titulo.trim() : ''
    if (t.length < 3 || t.length > 200) return { erro: 'Título entre 3 e 200 caracteres.' }
    patch.titulo = t
  }
  if (b.conteudo !== undefined || !parcial) {
    const c = typeof b.conteudo === 'string' ? b.conteudo.trim() : ''
    if (c.length < 1 || c.length > 6000) return { erro: 'Conteúdo entre 1 e 6.000 caracteres.' }
    patch.conteudo = c
  }
  if (b.categoria !== undefined || !parcial) {
    if (!CATEGORIAS.includes(b.categoria as typeof CATEGORIAS[number])) return { erro: 'Categoria inválida.' }
    patch.categoria = b.categoria
  }
  if (b.ativo !== undefined) patch.ativo = b.ativo === true
  if (b.ordem !== undefined) {
    const o = Number(b.ordem)
    if (!Number.isInteger(o)) return { erro: 'Ordem deve ser um número inteiro.' }
    patch.ordem = o
  }
  return { patch }
}

async function guard() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { resp: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) }
  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/suporte')) return { resp: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) }
  return { userId: user.id }
}

export async function POST(request: NextRequest) {
  const g = await guard()
  if ('resp' in g) return g.resp
  const body = (await request.json().catch(() => ({}))) as Entrada
  const v = validar(body, false)
  if ('erro' in v) return NextResponse.json({ error: 'VALIDATION_ERROR', message: v.erro }, { status: 422 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('support_knowledge')
    .insert({ ...v.patch, atualizado_por: g.userId })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })

  await logAdminAction({ action: 'support_knowledge_edit', targetKind: 'support_knowledge', targetId: data.id, after: v.patch })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function PATCH(request: NextRequest) {
  const g = await guard()
  if ('resp' in g) return g.resp
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'id obrigatório' }, { status: 422 })
  const body = (await request.json().catch(() => ({}))) as Entrada
  const v = validar(body, true)
  if ('erro' in v) return NextResponse.json({ error: 'VALIDATION_ERROR', message: v.erro }, { status: 422 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('support_knowledge')
    .update({ ...v.patch, atualizado_por: g.userId, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })

  await logAdminAction({ action: 'support_knowledge_edit', targetKind: 'support_knowledge', targetId: id, after: v.patch })
  return NextResponse.json({ ok: true })
}
