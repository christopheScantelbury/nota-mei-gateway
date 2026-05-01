import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WebhookPayload } from './types.js'
import { NotaMEIError } from './errors.js'

/**
 * Verifica a assinatura HMAC-SHA256 de um payload de webhook.
 *
 * Calcule usando o rawBody (string exata recebida no POST) e o secret
 * configurado em WEBHOOK_HMAC_SECRET. A comparação é feita em tempo
 * constante para evitar timing attacks.
 */
export function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature.startsWith('sha256=')) return false

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const receivedHex = signature.slice('sha256='.length)

  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(receivedHex, 'hex')

  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Raw wire format from the API (snake_case)
interface RawWebhookPayload {
  event: string
  nota_id: string
  status: string
  numero_nfse?: string | null
  codigo_verificacao?: string | null
  pdf_url?: string | null
  xml_url?: string | null
  emitida_em?: string | null
  erro_codigo?: string | null
  erro_descricao?: string | null
  signature: string
}

function mapWebhookPayload(raw: RawWebhookPayload): WebhookPayload {
  return {
    event: raw.event as WebhookPayload['event'],
    notaId: raw.nota_id,
    status: raw.status as WebhookPayload['status'],
    ...(raw.numero_nfse != null && { numeroNFSe: raw.numero_nfse }),
    ...(raw.codigo_verificacao != null && { codigoVerificacao: raw.codigo_verificacao }),
    ...(raw.pdf_url != null && { pdfUrl: raw.pdf_url }),
    ...(raw.xml_url != null && { xmlUrl: raw.xml_url }),
    ...(raw.emitida_em != null && { emitidaEm: raw.emitida_em }),
    ...(raw.erro_codigo != null && { erroCodigo: raw.erro_codigo }),
    ...(raw.erro_descricao != null && { erroDescricao: raw.erro_descricao }),
    signature: raw.signature,
  }
}

/**
 * Analisa e verifica um payload de webhook em uma única chamada.
 * Lança NotaMEIError com code 'FORBIDDEN' se a assinatura for inválida.
 */
export function parseWebhook(rawBody: string, signature: string, secret: string): WebhookPayload {
  if (!verifySignature(rawBody, signature, secret)) {
    throw new NotaMEIError('FORBIDDEN', 'Assinatura do webhook inválida', 403)
  }
  return mapWebhookPayload(JSON.parse(rawBody) as RawWebhookPayload)
}
