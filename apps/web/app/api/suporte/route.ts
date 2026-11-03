/**
 * Chat "Ajuda" do dashboard.
 *
 * GET  /api/suporte            → chamado em aberto do usuário (ou o último) + mensagens
 * POST /api/suporte            → { conteudo, anexo? } envia mensagem; se o chamado
 *                                está com a IA, responde na hora.
 *
 * Toda escrita usa service role DEPOIS de validar o dono pela sessão. A IA só lê
 * dados da empresa ativa do usuário (lib/suporte/agent.ts).
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveEmpresaId } from '@/lib/empresa'
import { responderCliente, SUPORTE_MODEL } from '@/lib/suporte/agent'
import { alertarEquipe } from '@/lib/suporte/notificacoes'
import { carregarMensagens, inicioDoDiaUTC, paraCliente, subirAnexo } from '@/lib/suporte/server'
import type { SupportTicket, TicketStatus } from '@/lib/suporte/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Cotas da IA (a IA anterior saiu em cee7c54 por custo sem limite).
const LIMITE_MSGS_USUARIO_DIA = Number(process.env.SUPORTE_IA_LIMITE_USUARIO_DIA ?? 40)
const LIMITE_RESPOSTAS_IA_DIA = Number(process.env.SUPORTE_IA_LIMITE_GLOBAL_DIA ?? 600)

type TicketRow = SupportTicket & { ai_transcript: BetaMessageParam[] }

function publicTicket(t: Pick<SupportTicket, 'id' | 'status' | 'created_at'>) {
  return { id: t.id, status: t.status, created_at: t.created_at }
}

async function chamadoAtual(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<TicketRow | null> {
  const { data } = await admin
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<TicketRow>()
  return data ?? null
}

export async function GET() {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const admin = createAdminClient()
  const ticket = await chamadoAtual(admin, user.id)
  if (!ticket) return NextResponse.json({ ticket: null, mensagens: [] })

  const mensagens = await carregarMensagens(admin, ticket.id, { incluirInterno: false })
  return NextResponse.json({ ticket: publicTicket(ticket), mensagens: paraCliente(mensagens) })
}

export async function POST(request: NextRequest) {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let body: { conteudo?: unknown; anexo?: unknown; pagina?: unknown }
  try { body = await request.json() } catch { body = {} }

  const conteudo = typeof body.conteudo === 'string' ? body.conteudo.trim() : ''
  if (conteudo.length < 1 || conteudo.length > 4000) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Escreva sua mensagem (até 4.000 caracteres).' },
      { status: 422 },
    )
  }
  const pagina = typeof body.pagina === 'string' ? body.pagina.slice(0, 200) : null

  const admin = createAdminClient()

  // Cota por usuário (mensagens do cliente nas últimas 24h, em todos os chamados).
  const desde24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count: msgsHoje } = await admin
    .from('support_messages')
    .select('id, support_tickets!inner(user_id)', { count: 'exact', head: true })
    .eq('autor', 'cliente')
    .eq('support_tickets.user_id', user.id)
    .gte('created_at', desde24h)
  if ((msgsHoje ?? 0) >= LIMITE_MSGS_USUARIO_DIA) {
    return NextResponse.json(
      { error: 'LIMITE', message: 'Você atingiu o limite de mensagens de hoje. Escreva para suporte@emitirnotafacil.com.br que respondemos por e-mail.' },
      { status: 429 },
    )
  }

  const empresaId = await getActiveEmpresaId(sb, user.id)

  // Chamado em aberto ou um novo (o anterior foi resolvido).
  let ticket = await chamadoAtual(admin, user.id)
  if (!ticket || ticket.status === 'resolvido') {
    const { data: novo, error } = await admin
      .from('support_tickets')
      .insert({ user_id: user.id, empresa_id: empresaId, assunto: conteudo.slice(0, 160) })
      .select('*')
      .single<TicketRow>()
    if (error || !novo) {
      return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Não foi possível abrir o chamado agora.' }, { status: 500 })
    }
    ticket = novo
  }

  // Anexo (opcional) no bucket privado.
  let anexoPath: string | null = null
  if (typeof body.anexo === 'string' && body.anexo) {
    const up = await subirAnexo(admin, user.id, ticket.id, body.anexo)
    if ('erro' in up) return NextResponse.json({ error: 'VALIDATION_ERROR', message: up.erro }, { status: 422 })
    anexoPath = up.path
  }

  // Trava: uma resposta da IA por vez neste chamado.
  if (ticket.status === 'ia') {
    const doisMin = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const { data: travado } = await admin
      .from('support_tickets')
      .update({ ia_processando_desde: new Date().toISOString() })
      .eq('id', ticket.id)
      .or(`ia_processando_desde.is.null,ia_processando_desde.lt.${doisMin}`)
      .select('id')
    if (!travado?.length) {
      return NextResponse.json(
        { error: 'OCUPADO', message: 'Aguarde a resposta da mensagem anterior.' },
        { status: 409 },
      )
    }
  }

  await admin.from('support_messages').insert({
    ticket_id: ticket.id,
    autor: 'cliente',
    autor_user_id: user.id,
    conteudo,
    anexo_path: anexoPath,
    metadata: pagina ? { pagina } : null,
  })

  let novoStatus: TicketStatus = ticket.status
  let ultimoAutor: 'cliente' | 'ia' | 'sistema' = 'cliente'
  const patch: Record<string, unknown> = {}

  // Nome da empresa para os alertas.
  let empresaNome = user.email ?? 'cliente'
  if (ticket.empresa_id) {
    const { data: e } = await admin.from('empresas').select('razao_social').eq('id', ticket.empresa_id).maybeSingle()
    if (e?.razao_social) empresaNome = e.razao_social
  }

  if (ticket.status === 'ia') {
    const { count: respostasHoje } = await admin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('autor', 'ia')
      .gte('created_at', inicioDoDiaUTC())

    const r = (respostasHoje ?? 0) >= LIMITE_RESPOSTAS_IA_DIA
      ? null
      : await responderCliente({
          admin,
          empresaId: ticket.empresa_id,
          transcript: Array.isArray(ticket.ai_transcript) ? ticket.ai_transcript : [],
          mensagem: conteudo + (pagina ? `\n(página do painel: ${pagina})` : ''),
          temAnexo: Boolean(anexoPath),
        })

    if (r) {
      await admin.rpc('support_append_transcript', {
        p_ticket: ticket.id,
        p_itens: r.novosItens,
        p_input: r.usage.input,
        p_output: r.usage.output,
        p_cache_read: r.usage.cacheRead,
        p_custo: Number(r.usage.custoUsd.toFixed(4)),
      })
    } else {
      await admin.from('support_tickets').update({ ia_processando_desde: null }).eq('id', ticket.id)
    }

    if (r?.texto) {
      await admin.from('support_messages').insert({
        ticket_id: ticket.id,
        autor: 'ia',
        conteudo: r.texto.slice(0, 8000),
        metadata: { modelo: SUPORTE_MODEL, ferramentas: r.ferramentas, usage: r.usage },
      })
      ultimoAutor = 'ia'
    }

    if (r?.escalada) {
      novoStatus = 'aguardando_humano'
      Object.assign(patch, {
        prioridade: r.escalada.prioridade,
        resumo: r.escalada.resumo,
        motivo_escalada: r.escalada.motivo,
      })
      await admin.from('support_messages').insert({
        ticket_id: ticket.id,
        autor: 'sistema',
        conteudo: 'Conversa transferida para a equipe do NotaFácil. Um atendente vai responder aqui.',
      })
      await alertarEquipe({
        ticketId: ticket.id,
        tipo: 'escalado',
        empresa: empresaNome,
        clienteEmail: user.email ?? null,
        prioridade: r.escalada.prioridade,
        resumo: `${r.escalada.motivo}\n\n${r.escalada.resumo}\n\nÚltima mensagem do cliente:\n${conteudo}`,
      })
    } else if (!r || !r.texto) {
      // IA indisponível (cota, chave, erro): não deixar o cliente sem resposta.
      novoStatus = 'aguardando_humano'
      const motivo = r?.falha ?? 'cota diária da IA atingida'
      Object.assign(patch, { motivo_escalada: `IA indisponível: ${motivo}` })
      await admin.from('support_messages').insert({
        ticket_id: ticket.id,
        autor: 'sistema',
        conteudo: 'Nosso assistente está indisponível no momento. Sua mensagem foi encaminhada para a equipe, que vai responder aqui.',
      })
      ultimoAutor = 'sistema'
      await alertarEquipe({
        ticketId: ticket.id,
        tipo: 'falha_ia',
        empresa: empresaNome,
        clienteEmail: user.email ?? null,
        prioridade: ticket.prioridade,
        resumo: `IA indisponível (${motivo}).\n\nMensagem do cliente:\n${conteudo}`,
      })
    }
  } else if (ticket.status === 'aguardando_cliente') {
    // Cliente respondeu ao atendente: volta para a fila humana.
    novoStatus = 'aguardando_humano'
    await alertarEquipe({
      ticketId: ticket.id,
      tipo: 'nova_mensagem',
      empresa: empresaNome,
      clienteEmail: user.email ?? null,
      prioridade: ticket.prioridade,
      resumo: conteudo,
    })
  }

  await admin
    .from('support_tickets')
    .update({
      ...patch,
      status: novoStatus,
      ultima_mensagem_em: new Date().toISOString(),
      ultima_mensagem_autor: ultimoAutor,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id)

  const mensagens = await carregarMensagens(admin, ticket.id, { incluirInterno: false })
  return NextResponse.json({
    ticket: publicTicket({ ...ticket, status: novoStatus }),
    mensagens: paraCliente(mensagens),
  })
}
