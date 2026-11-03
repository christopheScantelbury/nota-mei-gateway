// Tipos compartilhados do suporte (chat do cliente + /admin/suporte).

export type TicketStatus = 'ia' | 'aguardando_humano' | 'aguardando_cliente' | 'resolvido'
export type TicketPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente'
export type MensagemAutor = 'cliente' | 'ia' | 'atendente' | 'interno' | 'sistema'

export interface SupportTicket {
  id: string
  empresa_id: string | null
  user_id: string
  status: TicketStatus
  prioridade: TicketPrioridade
  assunto: string | null
  resumo: string | null
  motivo_escalada: string | null
  assumido_por: string | null
  ai_input_tokens: number
  ai_output_tokens: number
  ai_cache_read_tokens: number
  ai_custo_usd: number
  ultima_mensagem_em: string
  ultima_mensagem_autor: MensagemAutor | null
  resolvido_em: string | null
  created_at: string
}

export interface SupportMessage {
  id: string
  ticket_id: string
  autor: MensagemAutor
  autor_user_id: string | null
  conteudo: string
  anexo_path: string | null
  /** URL assinada temporária do anexo (preenchida pela rota, nunca persistida). */
  anexo_url?: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  ia: 'Assistente virtual',
  aguardando_humano: 'Aguardando atendente',
  aguardando_cliente: 'Aguardando cliente',
  resolvido: 'Resolvido',
}

export const PRIORIDADE_LABEL: Record<TicketPrioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const ANEXOS_BUCKET = 'suporte-anexos'
