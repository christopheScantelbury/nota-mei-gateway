// Alertas por e-mail do suporte (Brevo). Best-effort: falha de e-mail nunca
// derruba a resposta do chat.

import { sendHtmlEmail } from '@/lib/brevo/client'
import type { TicketPrioridade } from './types'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.emitirnotafacil.com.br'
const EQUIPE = process.env.SUPORTE_EMAIL_ALERTA ?? 'suporte@emitirnotafacil.com.br'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function paragrafos(s: string): string {
  return esc(s).replace(/\n/g, '<br>')
}

/** Avisa a equipe: chamado transferido para humano ou nova mensagem do cliente num chamado humano. */
export async function alertarEquipe(opts: {
  ticketId: string
  tipo: 'escalado' | 'nova_mensagem' | 'falha_ia'
  empresa: string
  clienteEmail: string | null
  prioridade: TicketPrioridade
  resumo: string
}): Promise<void> {
  const titulo =
    opts.tipo === 'escalado' ? 'Chamado transferido para atendente'
    : opts.tipo === 'falha_ia' ? 'Chamado sem resposta da IA'
    : 'Nova mensagem do cliente'
  const urgente = opts.prioridade === 'alta' || opts.prioridade === 'urgente'
  const link = `${SITE}/admin/suporte/${opts.ticketId}`

  try {
    await sendHtmlEmail({
      to: [{ email: EQUIPE }],
      subject: `${urgente ? '[PRIORIDADE ' + opts.prioridade.toUpperCase() + '] ' : ''}${titulo} — ${opts.empresa}`,
      tags: ['suporte', opts.tipo],
      ...(opts.clienteEmail ? { replyTo: { email: opts.clienteEmail } } : {}),
      htmlContent: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 8px">${esc(titulo)}</h2>
<p style="margin:0 0 4px"><b>Empresa:</b> ${esc(opts.empresa)}</p>
<p style="margin:0 0 4px"><b>Cliente:</b> ${esc(opts.clienteEmail ?? '—')}</p>
<p style="margin:0 0 12px"><b>Prioridade:</b> ${esc(opts.prioridade)}</p>
<div style="background:#f3f4f6;border-radius:8px;padding:12px;margin-bottom:16px">${paragrafos(opts.resumo)}</div>
<a href="${link}" style="background:#00a3b4;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir chamado</a>
</div>`,
    })
  } catch {
    // best-effort
  }
}

/** Avisa o cliente que a equipe respondeu no chat. */
export async function avisarClienteResposta(opts: { email: string; trecho: string }): Promise<void> {
  try {
    await sendHtmlEmail({
      to: [{ email: opts.email }],
      subject: 'Você recebeu uma resposta do suporte NotaFácil',
      tags: ['suporte', 'resposta_cliente'],
      htmlContent: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<p>Olá! Nossa equipe respondeu seu chamado:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:12px;margin:12px 0">${paragrafos(opts.trecho.slice(0, 1200))}</div>
<p>Para continuar a conversa, abra o painel e clique em <b>Ajuda</b>:</p>
<a href="${SITE}/home" style="background:#00a3b4;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Abrir o painel</a>
<p style="color:#666;font-size:12px;margin-top:16px">Não responda este e-mail — use o chat do painel.</p>
</div>`,
    })
  } catch {
    // best-effort
  }
}
