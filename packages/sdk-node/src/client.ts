import { HttpClient } from './http.js'
import { NotaMEIError } from './errors.js'
import { verifySignature } from './webhook.js'
import type {
  ClientOptions,
  EmissaoInput,
  ListarOptions,
  ListaNotas,
  NotaDetalhe,
  NotaResumo,
  NotaResposta,
  UsageData,
  WebhookPayload,
} from './types.js'

// ── Internal API shapes (snake_case) ──────────────────────────────────────────

interface ApiServico {
  codigo_nbs: string
  discriminacao: string
  valor: number
  aliquota_iss: number
}

interface ApiTomador {
  tipo: 'PJ' | 'PF'
  documento: string
  razao_social: string
  email?: string
  municipio_ibge?: string
}

interface ApiEmissaoRequest {
  servico: ApiServico
  tomador: ApiTomador
  competencia: string
  webhook_url?: string
}

interface ApiEmissaoResponse {
  nota_id: string
  status: string
  mensagem: string
}

interface ApiNotaResumo {
  id: string
  status: string
  numero_nfse?: string | null
  valor_servico?: number
  tomador_nome?: string
  competencia: string
  emitida_em?: string | null
  created_at: string
}

interface ApiNotaDetalhe extends ApiNotaResumo {
  protocolo_receita?: string | null
  codigo_verificacao?: string | null
  tomador_doc?: string
  erro_codigo?: string | null
  erro_descricao?: string | null
  webhook_url?: string | null
  webhook_entregue: boolean
  webhook_tentativas: number
  cancelada_em?: string | null
  updated_at: string
}

interface ApiListaNotas {
  data: ApiNotaResumo[]
  total: number
  limit: number
  offset: number
}

interface ApiUsage {
  competencia: string
  total_emitidas: number
  limite: number
  excedentes: number
  plano: string
  stripe_status: string
  renovacao_em?: string | null
}

interface ApiBillingPortal {
  url: string
}

interface ApiCheckout {
  checkout_url: string
}

interface ApiCancelResponse {
  nota_id: string
  status: string
  mensagem: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toApiEmissao(input: EmissaoInput): ApiEmissaoRequest {
  const tipo = input.tomador.tipo ?? (input.tomador.cpf ? 'PF' : 'PJ')
  const documento = tipo === 'PF'
    ? (input.tomador.cpf ?? '')
    : (input.tomador.cnpj ?? '')

  return {
    servico: {
      codigo_nbs: input.servico.codigoNBS,
      discriminacao: input.servico.discriminacao,
      valor: input.servico.valor,
      aliquota_iss: input.servico.aliquotaISS,
    },
    tomador: {
      tipo,
      documento,
      razao_social: input.tomador.razaoSocial,
      ...(input.tomador.email !== undefined && { email: input.tomador.email }),
      ...(input.tomador.municipioIBGE !== undefined && { municipio_ibge: input.tomador.municipioIBGE }),
    },
    competencia: input.competencia ?? currentCompetencia(),
    ...(input.webhookUrl !== undefined && { webhook_url: input.webhookUrl }),
  }
}

function toNotaResposta(r: ApiEmissaoResponse): NotaResposta {
  return { id: r.nota_id, status: r.status as NotaResposta['status'], mensagem: r.mensagem }
}

function toNotaResumo(r: ApiNotaResumo): NotaResumo {
  return {
    id: r.id,
    status: r.status as NotaResumo['status'],
    ...(r.numero_nfse != null && { numeroNFSe: r.numero_nfse }),
    ...(r.valor_servico !== undefined && { valorServico: r.valor_servico }),
    ...(r.tomador_nome !== undefined && { tomadorNome: r.tomador_nome }),
    competencia: r.competencia,
    ...(r.emitida_em != null && { emitidaEm: r.emitida_em }),
    createdAt: r.created_at,
  }
}

function toNotaDetalhe(r: ApiNotaDetalhe): NotaDetalhe {
  return {
    ...toNotaResumo(r),
    ...(r.protocolo_receita != null && { protocoloReceita: r.protocolo_receita }),
    ...(r.codigo_verificacao != null && { codigoVerificacao: r.codigo_verificacao }),
    ...(r.tomador_doc !== undefined && { tomadorDoc: r.tomador_doc }),
    ...(r.erro_codigo != null && { erroCodigo: r.erro_codigo }),
    ...(r.erro_descricao != null && { erroDescricao: r.erro_descricao }),
    ...(r.webhook_url != null && { webhookUrl: r.webhook_url }),
    webhookEntregue: r.webhook_entregue,
    webhookTentativas: r.webhook_tentativas,
    ...(r.cancelada_em != null && { canceladaEm: r.cancelada_em }),
    updatedAt: r.updated_at,
  }
}

function toUsageData(r: ApiUsage): UsageData {
  return {
    competencia: r.competencia,
    totalEmitidas: r.total_emitidas,
    limite: r.limite,
    excedentes: r.excedentes,
    plano: r.plano as UsageData['plano'],
    stripeStatus: r.stripe_status,
    ...(r.renovacao_em != null && { renovacaoEm: r.renovacao_em }),
  }
}

function currentCompetencia(): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}-${mm}`
}

// ── BillingClient ─────────────────────────────────────────────────────────────

export interface BillingCheckoutOptions {
  successUrl?: string
  cancelUrl?: string
}

export class BillingClient {
  constructor(private readonly http: HttpClient) {}

  async usage(): Promise<UsageData> {
    const r = await this.http.request<ApiUsage>({ method: 'GET', urlOrPath: '/v1/billing/usage', responseType: 'json' })
    return toUsageData(r)
  }

  async portal(): Promise<string> {
    const r = await this.http.request<ApiBillingPortal>({ method: 'GET', urlOrPath: '/v1/billing/portal', responseType: 'json' })
    return r.url
  }

  async checkout(priceId: string, opts: BillingCheckoutOptions = {}): Promise<string> {
    const r = await this.http.request<ApiCheckout>({
      method: 'POST',
      urlOrPath: '/v1/billing/checkout',
      responseType: 'json',
      body: {
        price_id: priceId,
        ...(opts.successUrl !== undefined && { success_url: opts.successUrl }),
        ...(opts.cancelUrl !== undefined && { cancel_url: opts.cancelUrl }),
      },
    })
    return r.checkout_url
  }
}

// ── NotaMEI ───────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://api.emitirnotafacil.com.br'

export class NotaMEI {
  private readonly http: HttpClient
  readonly billing: BillingClient

  constructor(apiKey: string, options: ClientOptions = {}) {
    this.http = new HttpClient({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      apiKey,
      timeout: options.timeout ?? 30_000,
      maxRetries: options.maxRetries ?? 3,
    })
    this.billing = new BillingClient(this.http)
  }

  async emitir(input: EmissaoInput): Promise<NotaResposta> {
    const headers: Record<string, string> = {}
    if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey

    const r = await this.http.request<ApiEmissaoResponse>({
      method: 'POST',
      urlOrPath: '/v1/nfse',
      responseType: 'json',
      body: toApiEmissao(input),
      headers,
    })
    return toNotaResposta(r)
  }

  async consultar(notaId: string): Promise<NotaDetalhe> {
    const r = await this.http.request<ApiNotaDetalhe>({
      method: 'GET',
      urlOrPath: `/v1/nfse/${encodeURIComponent(notaId)}`,
      responseType: 'json',
    })
    return toNotaDetalhe(r)
  }

  async listar(options: ListarOptions = {}): Promise<ListaNotas> {
    const qs = new URLSearchParams()
    if (options.limit !== undefined) qs.set('limit', String(options.limit))
    if (options.offset !== undefined) qs.set('offset', String(options.offset))
    if (options.status !== undefined) qs.set('status', options.status)
    if (options.competencia !== undefined) qs.set('competencia', options.competencia)

    const path = qs.size > 0 ? `/v1/nfse?${qs}` : '/v1/nfse'
    const r = await this.http.request<ApiListaNotas>({ method: 'GET', urlOrPath: path, responseType: 'json' })
    return { data: r.data.map(toNotaResumo), total: r.total, limit: r.limit, offset: r.offset }
  }

  async cancelar(notaId: string): Promise<{ notaId: string; status: string; mensagem: string }> {
    const r = await this.http.request<ApiCancelResponse>({
      method: 'DELETE',
      urlOrPath: `/v1/nfse/${encodeURIComponent(notaId)}`,
      responseType: 'json',
    })
    return { notaId: r.nota_id, status: r.status, mensagem: r.mensagem }
  }

  async pdf(notaId: string): Promise<Buffer> {
    return this.http.request<Buffer>({
      method: 'GET',
      urlOrPath: `/v1/nfse/${encodeURIComponent(notaId)}/pdf`,
      responseType: 'buffer',
    })
  }

  async xml(notaId: string): Promise<string> {
    return this.http.request<string>({
      method: 'GET',
      urlOrPath: `/v1/nfse/${encodeURIComponent(notaId)}/xml`,
      responseType: 'text',
    })
  }

  verifyWebhook(rawBody: string, signature: string, secret: string): boolean {
    return verifySignature(rawBody, signature, secret)
  }

  parseWebhook(rawBody: string, signature: string, secret: string): WebhookPayload {
    if (!verifySignature(rawBody, signature, secret)) {
      throw new NotaMEIError('FORBIDDEN', 'Assinatura do webhook inválida', 403)
    }
    return JSON.parse(rawBody) as WebhookPayload
  }
}
