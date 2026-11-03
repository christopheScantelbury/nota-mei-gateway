/**
 * PATCH /admin/api/suporte/[id] — status, prioridade e "assumir" chamado.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canWrite, getAdminContext } from '@/lib/admin/permissions'
import { logAdminAction } from '@/lib/admin/audit'
import type { TicketPrioridade, TicketStatus } from '@/lib/suporte/types'

const STATUS: TicketStatus[] = ['ia', 'aguardando_humano', 'aguardando_cliente', 'resolvido']
const PRIORIDADES: TicketPrioridade[] = ['baixa', 'normal', 'alta', 'urgente']

interface Ctx { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const ctx = await getAdminContext(user.id, sb)
  if (!canWrite(ctx, '/admin/suporte')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  let body: { status?: string; prioridade?: string; assumir?: boolean }
  try { body = await request.json() } catch { body = {} }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) {
    if (!STATUS.includes(body.status as TicketStatus)) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'status inválido' }, { status: 422 })
    }
    patch.status = body.status
    patch.resolvido_em = body.status === 'resolvido' ? new Date().toISOString() : null
  }
  if (body.prioridade !== undefined) {
    if (!PRIORIDADES.includes(body.prioridade as TicketPrioridade)) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', message: 'prioridade inválida' }, { status: 422 })
    }
    patch.prioridade = body.prioridade
  }
  if (body.assumir === true) {
    patch.assumido_por = user.id
    // Assumir tira a IA da conversa.
    if (patch.status === undefined) patch.status = 'aguardando_humano'
  }

  const admin = createAdminClient()
  const { data: antes } = await admin.from('support_tickets').select('status, prioridade, assumido_por').eq('id', params.id).maybeSingle()
  if (!antes) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const { error } = await admin.from('support_tickets').update(patch).eq('id', params.id)
  if (error) return NextResponse.json({ error: 'INTERNAL_ERROR', message: error.message }, { status: 500 })

  if (patch.status === 'resolvido' && antes.status !== 'resolvido') {
    await admin.from('support_messages').insert({
      ticket_id: params.id,
      autor: 'sistema',
      conteudo: 'Atendimento encerrado pela equipe. Se precisar de mais alguma coisa, é só escrever.',
    })
  }

  await logAdminAction({ action: 'support_update', targetKind: 'support_ticket', targetId: params.id, before: antes, after: patch })
  return NextResponse.json({ ok: true })
}
