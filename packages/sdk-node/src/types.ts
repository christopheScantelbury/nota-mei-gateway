// Types derived from the Nota MEI Gateway OpenAPI 3.1 spec (docs/openapi.yaml).
// Keep in sync with any breaking changes to the API contracts.

export type NotaStatus =
  | 'PROCESSANDO'
  | 'AUTORIZADA'
  | 'REJEITADA'
  | 'CANCELADA'
  | 'ERRO_TEMPORARIO'

export type TomadorTipo = 'PJ' | 'PF'

export type PlanoNome = 'Trial' | 'Starter' | 'Basic' | 'Pro' | 'Business'

export type WebhookEvent =
  | 'nfse.autorizada'
  | 'nfse.rejeitada'
  | 'nfse.cancelada'

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface ServicoInput {
  /** Código NBS — ex: "01.01.01.10" */
  codigoNBS: string
  /** Descrição do serviço prestado (mín. 10 chars) */
  discriminacao: string
  /** Valor em BRL (ex: 3500.00) */
  valor: number
  /** Alíquota ISS em % (ex: 2.0) */
  aliquotaISS: number
}

export interface TomadorInput {
  /** "PJ" (padrão) ou "PF" */
  tipo?: TomadorTipo
  /** CNPJ sem pontuação — 14 dígitos (PJ) */
  cnpj?: string
  /** CPF sem pontuação — 11 dígitos (PF) */
  cpf?: string
  /** Nome ou razão social */
  razaoSocial: string
  /** E-mail para envio da nota (opcional) */
  email?: string
  /** Código IBGE do município — 7 dígitos (opcional para PJ do mesmo município) */
  municipioIBGE?: string
}

export interface EmissaoInput {
  servico: ServicoInput
  tomador: TomadorInput
  /** Competência no formato AAAA-MM. Padrão: mês atual. */
  competencia?: string
  /** URL para receber o resultado assíncrono via webhook */
  webhookUrl?: string
  /** Chave de idempotência para evitar duplicatas em retentativas */
  idempotencyKey?: string
}

export interface ListarOptions {
  /** Itens por página (1–100, padrão: 20) */
  limit?: number
  /** Offset para paginação (padrão: 0) */
  offset?: number
  /** Filtrar por status */
  status?: NotaStatus
  /** Filtrar por competência (AAAA-MM) */
  competencia?: string
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface NotaResposta {
  /** UUID da nota criada */
  id: string
  status: NotaStatus
  mensagem: string
}

export interface NotaResumo {
  id: string
  status: NotaStatus
  numeroNFSe?: string
  valorServico?: number
  tomadorNome?: string
  competencia: string
  emitidaEm?: string
  createdAt: string
}

export interface NotaDetalhe extends NotaResumo {
  protocoloReceita?: string
  codigoVerificacao?: string
  tomadorDoc?: string
  erroCodigo?: string
  erroDescricao?: string
  webhookUrl?: string
  webhookEntregue: boolean
  webhookTentativas: number
  canceladaEm?: string
  updatedAt: string
}

export interface ListaNotas {
  data: NotaResumo[]
  total: number
  limit: number
  offset: number
}

export interface UsageData {
  competencia: string
  totalEmitidas: number
  limite: number
  excedentes: number
  plano: PlanoNome
  stripeStatus: string
  renovacaoEm?: string
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: WebhookEvent
  notaId: string
  status: NotaStatus
  /** Presente apenas em nfse.autorizada */
  numeroNFSe?: string
  /** Presente apenas em nfse.autorizada */
  codigoVerificacao?: string
  /** Presente apenas em nfse.autorizada */
  pdfUrl?: string
  /** Presente apenas em nfse.autorizada */
  xmlUrl?: string
  /** Presente apenas em nfse.autorizada */
  emitidaEm?: string
  /** Presente apenas em nfse.rejeitada */
  erroCodigo?: string
  /** Presente apenas em nfse.rejeitada */
  erroDescricao?: string
  /** Assinatura HMAC-SHA256 — formato: "sha256=<hex>" */
  signature: string
}

// ── Client options ────────────────────────────────────────────────────────────

export interface ClientOptions {
  /**
   * Base URL da API.
   * Padrão: "https://api.emitirnotafacil.com.br"
   * Sandbox público: "https://sandbox.emitirnotafacil.com.br"
   */
  baseUrl?: string
  /** Timeout em ms por requisição (padrão: 30_000) */
  timeout?: number
  /**
   * Número máximo de retentativas em erros 5xx (padrão: 3).
   * Usa backoff exponencial: 1s → 2s → 4s.
   */
  maxRetries?: number
}
