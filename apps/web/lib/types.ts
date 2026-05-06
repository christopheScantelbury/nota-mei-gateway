// Shared TypeScript types matching the Supabase schema.

export type NotaStatus =
  | 'PROCESSANDO'
  | 'AUTORIZADA'
  | 'REJEITADA'
  | 'CANCELADA'
  | 'ERRO_TEMPORARIO'

export type RegimeTributario =
  | 'SIMPLES_MEI'
  | 'SIMPLES_NACIONAL'
  | 'LUCRO_PRESUMIDO'
  | 'LUCRO_REAL'
  | null

export interface Nota {
  id: string
  mei_id: string | null
  empresa_id: string | null
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
  /** substituida_por: UUID of the replacement nota when cancelled via substituição (ME-32) */
  substituida_por: string | null
  /** regime_tributario: tax regime — stored on the nota for reporting/badge display (ME-42) */
  regime_tributario: RegimeTributario
  /** iss_retido: true when ISS was withheld by the tomador (LP/LR companies only, ME-42) */
  iss_retido: boolean | null
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
  tipo_usuario: 'mei' | 'gateway'
}
