// Cliente HTTP mínimo do Brevo (Transactional API + Track Event API).
//
// Doc: https://developers.brevo.com/reference/sendtransacemail
// Doc: https://developers.brevo.com/reference/createevent
//
// Spec: HIST-6.1.
//
// Variáveis necessárias:
//   BREVO_API_KEY — chave xkeysib-... (API v3 HTTP, NÃO a chave SMTP)
//   BREVO_EVENTS_API_KEY — alguns endpoints de Tracker exigem chave Events;
//     se ausente, usa BREVO_API_KEY como fallback.

const BASE = 'https://api.brevo.com/v3'

function getKey(): string | null {
  return process.env.BREVO_API_KEY ?? null
}

export interface TrackEventInput {
  event_name: string
  identifiers: { email_id: string }
  contact_properties?: Record<string, unknown>
  event_properties?: Record<string, unknown>
}

/** Envia evento custom pro Brevo Tracker (não dispara e-mail por si só). */
export async function trackEvent(input: TrackEventInput): Promise<{ ok: boolean; status: number; message?: string }> {
  const key = process.env.BREVO_EVENTS_API_KEY ?? getKey()
  if (!key) return { ok: false, status: 0, message: 'BREVO_API_KEY ausente' }

  const res = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: {
      'api-key': key,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (res.ok) return { ok: true, status: res.status }
  const text = await res.text().catch(() => '')
  return { ok: false, status: res.status, message: text.slice(0, 500) }
}

export interface SendTemplateInput {
  templateId: number
  to: Array<{ email: string; name?: string }>
  params?: Record<string, unknown>
  tags?: string[]
}

/** Envia e-mail via template do Brevo. */
export async function sendTransactionalEmail(input: SendTemplateInput): Promise<{ ok: boolean; status: number; messageId?: string; message?: string }> {
  const key = getKey()
  if (!key) return { ok: false, status: 0, message: 'BREVO_API_KEY ausente' }

  const res = await fetch(`${BASE}/smtp/email`, {
    method: 'POST',
    headers: {
      'api-key': key,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      templateId: input.templateId,
      to: input.to,
      params: input.params,
      tags: input.tags,
    }),
  })

  if (res.ok) {
    const json = await res.json().catch(() => ({})) as { messageId?: string }
    return { ok: true, status: res.status, messageId: json.messageId }
  }
  const text = await res.text().catch(() => '')
  return { ok: false, status: res.status, message: text.slice(0, 500) }
}
