// Shared TypeScript types matching the Supabase schema.

export type NotaStatus =
  | 'PROCESSANDO'
  | 'AUTORIZADA'
  | 'REJEITADA'
  | 'CANCELADA'
  | 'ERRO_TEMPORARIO'

export interface Nota {
  id: string
  mei_id: string
  numero_rps: number
  status: NotaStatus
  protocolo_receita: string | null
  numero_nfse: string | null
  codigo_verificacao: string | null
  pdf_path: string | null
  webhook_url: string | null
  webhook_entregue: boolean
  webhook_tentativas: number
  tomador_doc: string | null
  tomador_nome: string | null
  valor_servico: number | null
  competencia: string | null
  erro_codigo: string | null
  erro_descricao: string | null
  cancelada_em: string | null
  emitida_em: string | null
  created_at: string
  updated_at: string
}

export interface EmissaoMensal {
  id: string
  mei_id: string
  competencia: string
  total_emitidas: number
  stripe_subscription_id: string | null
  stripe_subscription_status: string | null
  renovacao_em: string | null
  planos?: {
    nome: string
    emissoes_limite: number
    preco_mensal_brl: number | null
  }
}

export interface MEI {
  id: string
  cnpj: string
  razao_social: string
  email: string
  municipio_ibge: string
  stripe_customer_id: string | null
}
