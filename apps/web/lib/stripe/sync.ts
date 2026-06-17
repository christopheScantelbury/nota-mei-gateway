/**
 * Stripe sync wrappers pra /admin/planos (#236).
 *
 * Stripe price é IMUTÁVEL — toda mudança de preço cria novo price +
 * archive antigo + migra assinaturas ativas. Idempotência via metadata.
 *
 * Usa fetch direto (não SDK) pra evitar bundle extra. Mesma estratégia
 * de /api/billing/checkout/route.ts.
 */

const STRIPE_API = 'https://api.stripe.com/v1'

function bearer() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
  return `Bearer ${key}`
}

async function stripeRequest<T = unknown>(
  path: string,
  init?: { method?: string; body?: URLSearchParams },
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: bearer(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: init?.body?.toString(),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(err.error?.message ?? `Stripe ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Product helpers ─────────────────────────────────────────────────────────

export async function createProduct(input: {
  name: string
  description?: string | null
}): Promise<{ id: string }> {
  const body = new URLSearchParams()
  body.set('name', input.name)
  if (input.description) body.set('description', input.description)
  return stripeRequest('/products', { method: 'POST', body })
}

export async function updateProduct(
  productId: string,
  input: { name?: string; description?: string | null; active?: boolean },
): Promise<void> {
  const body = new URLSearchParams()
  if (input.name !== undefined) body.set('name', input.name)
  if (input.description !== undefined) body.set('description', input.description ?? '')
  if (input.active !== undefined) body.set('active', String(input.active))
  await stripeRequest(`/products/${productId}`, { method: 'POST', body })
}

// ── Price helpers ───────────────────────────────────────────────────────────

export async function createPrice(input: {
  productId: string
  unitAmountCents: number
  recurring: { interval: 'month' | 'year' }
  metadata?: Record<string, string>
}): Promise<{ id: string }> {
  const body = new URLSearchParams()
  body.set('product', input.productId)
  body.set('unit_amount', String(input.unitAmountCents))
  body.set('currency', 'brl')
  body.set('recurring[interval]', input.recurring.interval)
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    body.set(`metadata[${k}]`, v)
  }
  return stripeRequest('/prices', { method: 'POST', body })
}

export async function createOneTimePrice(input: {
  productId: string
  unitAmountCents: number
}): Promise<{ id: string }> {
  const body = new URLSearchParams()
  body.set('product', input.productId)
  body.set('unit_amount', String(input.unitAmountCents))
  body.set('currency', 'brl')
  return stripeRequest('/prices', { method: 'POST', body })
}

export async function archivePrice(priceId: string): Promise<void> {
  const body = new URLSearchParams({ active: 'false' })
  await stripeRequest(`/prices/${priceId}`, { method: 'POST', body })
}

// ── Subscription migration ──────────────────────────────────────────────────
// Quando o admin muda o preço de um plano, criamos novo price + archive
// antigo. As assinaturas ativas com o price antigo precisam ser migradas
// pro novo via `subscription.update`.

export async function listActiveSubscriptions(priceId: string): Promise<
  Array<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
> {
  const subs: Array<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }> = []
  let starting: string | undefined
  while (true) {
    const params = new URLSearchParams({ status: 'active', price: priceId, limit: '100' })
    if (starting) params.set('starting_after', starting)
    const page = await stripeRequest<{
      has_more: boolean
      data: Array<{ id: string; items: { data: Array<{ id: string; price: { id: string } }> } }>
    }>(`/subscriptions?${params}`)
    subs.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    starting = page.data[page.data.length - 1].id
  }
  return subs
}

export async function migrateSubscriptionsToNewPrice(
  oldPriceId: string,
  newPriceId: string,
): Promise<{ migrated: number; errors: Array<{ subId: string; err: string }> }> {
  const subs = await listActiveSubscriptions(oldPriceId)
  const errors: Array<{ subId: string; err: string }> = []
  let migrated = 0
  for (const sub of subs) {
    const itemId = sub.items.data.find((i) => i.price.id === oldPriceId)?.id
    if (!itemId) continue
    const body = new URLSearchParams()
    body.set(`items[0][id]`, itemId)
    body.set(`items[0][price]`, newPriceId)
    body.set('proration_behavior', 'create_prorations')
    try {
      await stripeRequest(`/subscriptions/${sub.id}`, { method: 'POST', body })
      migrated++
    } catch (e) {
      errors.push({ subId: sub.id, err: e instanceof Error ? e.message : String(e) })
    }
  }
  return { migrated, errors }
}

// ── High-level: sync plano change ───────────────────────────────────────────

export interface SyncResult {
  ok: boolean
  newPriceId?: string
  oldPriceId?: string
  productUpdated?: boolean
  migrated?: number
  errors?: string[]
}

/**
 * Aplica mudança no Stripe:
 *   - Se preço mudou: cria novo price + archive antigo + migra subs.
 *   - Se nome/descrição mudou: update product.
 *
 * O caller é responsável por persistir o novo stripe_price_id e logar
 * em planos_history.
 */
export async function syncPlanoChange(input: {
  productId: string | null
  oldPriceId: string | null
  newPriceCents: number  // 0 = sem preço recorrente (plano grátis ou avulso)
  isRecurring: boolean
  productName?: string
  productDescription?: string | null
  planoId: string  // pra metadata.plano_id no price novo
}): Promise<SyncResult> {
  const errors: string[] = []
  let productUpdated = false
  let newPriceId: string | undefined
  let migrated: number | undefined

  // 1. Update product (nome/descrição) se mudou
  if (input.productId && (input.productName || input.productDescription !== undefined)) {
    try {
      await updateProduct(input.productId, {
        name: input.productName,
        description: input.productDescription,
      })
      productUpdated = true
    } catch (e) {
      errors.push(`product update: ${e instanceof Error ? e.message : e}`)
    }
  }

  // 2. Se preço mudou, cria novo price + migra
  const needNewPrice =
    input.newPriceCents > 0 &&
    input.productId &&
    (input.oldPriceId == null || true)  // sempre cria se mudou — caller decide se chamar

  if (needNewPrice && input.productId) {
    try {
      const created = input.isRecurring
        ? await createPrice({
            productId: input.productId,
            unitAmountCents: input.newPriceCents,
            recurring: { interval: 'month' },
            metadata: { plano_id: input.planoId },
          })
        : await createOneTimePrice({
            productId: input.productId,
            unitAmountCents: input.newPriceCents,
          })
      newPriceId = created.id

      // Migra subs ativas (só faz sentido pra recurring)
      if (input.oldPriceId && input.isRecurring) {
        const migrateRes = await migrateSubscriptionsToNewPrice(input.oldPriceId, newPriceId)
        migrated = migrateRes.migrated
        for (const e of migrateRes.errors) {
          errors.push(`sub ${e.subId}: ${e.err}`)
        }
        // Archive old price
        try {
          await archivePrice(input.oldPriceId)
        } catch (e) {
          errors.push(`archive old price: ${e instanceof Error ? e.message : e}`)
        }
      }
    } catch (e) {
      errors.push(`price create: ${e instanceof Error ? e.message : e}`)
    }
  }

  return {
    ok: errors.length === 0,
    newPriceId,
    oldPriceId: input.oldPriceId ?? undefined,
    productUpdated,
    migrated,
    errors: errors.length > 0 ? errors : undefined,
  }
}
