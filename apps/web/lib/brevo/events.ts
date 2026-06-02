// Helper para enfileirar eventos ao Brevo com idempotência.
//
// Spec: HIST-6.1 + D-16 + D-17.

import { createClient } from '@supabase/supabase-js'

export type BrevoEventName =
  | 'user_signup'
  | 'cert_uploaded'
  | 'first_nfse_created'
  | 'first_nfse_authorized'
  | 'plan_upgraded'

interface EnqueueParams {
  eventName: BrevoEventName
  email: string
  contactId?: number
  properties?: Record<string, unknown>
  occurredAt?: Date
  /**
   * Chave de idempotência. Se omitida, deriva de (email, eventName, minuto).
   * Mesma chave duplicada -> ON CONFLICT DO NOTHING (D-16).
   */
  eventId?: string
}

/** Service-role client — bypassa RLS, usado por server actions e workers. */
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Enfileira um evento pra processar pelo worker Brevo.
 * Não envia nada agora — o worker (`/api/cron/brevo-queue`) consome em batch.
 *
 * Idempotência: combina email+evento+minuto pra evitar duplicação acidental
 * de chamadas em <1min (race conditions). Pra forçar duplicata, passar eventId.
 */
export async function enqueueBrevoEvent(params: EnqueueParams): Promise<{ ok: boolean }> {
  const occurredAt = params.occurredAt ?? new Date()
  const minuteBucket = Math.floor(occurredAt.getTime() / 60_000)
  const eventId = params.eventId ?? `${params.email}:${params.eventName}:${minuteBucket}`

  const sb = adminClient()
  // upsert com onConflict no event_id (UNIQUE) — duplicata é no-op.
  const { error } = await sb.from('brevo_event_queue').upsert(
    {
      event_id:    eventId,
      event_name:  params.eventName,
      email:       params.email,
      contact_id:  params.contactId ?? null,
      properties:  params.properties ?? {},
      occurred_at: occurredAt.toISOString(),
      status:      'pending',
    },
    { onConflict: 'event_id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[brevo/events] enqueue failed', error)
    return { ok: false }
  }
  return { ok: true }
}
