/**
 * POST /admin/api/suporte/[id]/mensagens — resposta da equipe ao cliente
 * ({ conteudo }) ou nota interna ({ conteudo, interno: true }, invisível ao cliente).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import { avisarClienteResposta } from '@/lib/suporte/notificacoes'

interface Ctx { params: { id: string } }

export async function POST(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/suporte')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { conteudo?: unknown; interno?: unknown }
  try { body = await request.json() } catch { body = {} }
  const conteudo = typeof body.conteudo === 'string' ? body.conteudo.trim() : ''
  const interno = body.interno === true
  if (conteudo.length < 1 || conteudo.length > 8000) {
    return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'Mensagem vazia ou longa demais.' }, { status: 422 })
  }

  const admin = createAdminClient()
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, user_id, status, assumido_por')
    .eq('id', params.id)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const { error } = await admin.from('support_messages').insert({
    ticket_id: ticket.id,
    autor: interno ? 'interno' : 'atendente',
    autor_user_id: user.id,
    conteudo,
  })
  if (error) return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })

  if (!interno) {
    // Resposta da equipe: a IA sai da conversa e o chamado aguarda o cliente.
    await admin
      .from('support_tickets')
      .update({
        status: 'aguardando_cliente',
        assumido_por: ticket.assumido_por ?? user.id,
        resolvido_em: null,
        ultima_mensagem_em: new Date().toISOString(),
        ultima_mensagem_autor: 'atendente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.id)

    const { data: cliente } = await admin.auth.admin.getUserById(ticket.user_id)
    if (cliente?.user?.email) await avisarClienteResposta({ email: cliente.user.email, trecho: conteudo })
  }

  await logAdminAction({
    action: 'support_reply',
    targetKind: 'support_ticket',
    targetId: ticket.id,
    after: { interno, tamanho: conteudo.length },
  })
  return NextResponse.json({ ok: true })
}
