---
name: nota-mei-stripe
description: Stripe billing — checkout, webhook, catalog sync, slug→price_id resolution. Use SEMPRE que mexer em `/api/billing/checkout`, `apps/api/internal/handler/stripe_webhook.go`, `apps/api/internal/handler/billing.go`, ou scripts de catálogo Stripe. Cobre o pacote de 6 bugs do upgrade flow corrigidos em commits b484884 + 2805523.
---

# Stripe billing

Stripe LIVE em produção desde 2026-05-06. Catálogo refeito 2026-06-05 com 10 planos (9 com price ativo + 1 Trial EPP sem price). **NUNCA hardcode `stripe_price_id` em env var** — sempre buscar via `planos` table que é a fonte única de verdade.

## Catálogo atual (LIVE)

| Plano | Limite | Preço | stripe_price_id (LIVE) |
|---|---|---|---|
| Trial MEI | 5 | R$ 0 | `price_1Tf0psQkYQoRUOWm2igKaLQS` |
| Avulso MEI | 0 (por nota) | R$ 5,99/nota | `price_1Tf0r8QkYQoRUOWmXDS4AyAA` |
| MEI Mensal | 5 | R$ 19,90/mês | `price_1Tf0r7QkYQoRUOWmHJ0JRjod` |
| MEI Plus | 15 | R$ 39,90/mês | `price_1Tf0r8QkYQoRUOWmsc74N6sq` |
| MEI Premium | 100 | R$ 79,90/mês | `price_1Tf0r8QkYQoRUOWmGWYfkoWT` |
| Trial ME | 5 | R$ 0 | `price_1Tf0r8QkYQoRUOWmEsgIim8Q` |
| ME Start | 10 | R$ 59,99/mês | `price_1Tf0psQkYQoRUOWmuQnm2z3a` |
| ME Pro | 50 | R$ 149,90/mês | `price_1Tf0r7QkYQoRUOWmVFu5FET4` |
| ME Business | 300 | R$ 299,90/mês | `price_1Tf0r7QkYQoRUOWmFnBiJrmI` |
| Trial EPP | 5 | (consulta) | NULL |

## Resolução slug → stripe_price_id (✅ pattern correto)

### Next.js `/api/billing/checkout/route.ts`

```ts
function slugToPlanoNome(slug: string): string {
  switch (slug.toLowerCase().trim()) {
    case 'trial-mei': case 'trial_mei':   return 'Trial MEI'
    case 'avulso':                         return 'Avulso MEI'
    case 'mensal': case 'mei-mensal':     return 'MEI Mensal'
    case 'plus':   case 'mei-plus':       return 'MEI Plus'
    case 'premium': case 'mei-premium':   return 'MEI Premium'
    case 'trial-me': case 'trial_me':     return 'Trial ME'
    case 'start':  case 'me-start':       return 'ME Start'
    case 'pro':    case 'me-pro':         return 'ME Pro'
    case 'business': case 'me-business':  return 'ME Business'
    // Legacy slugs (compat retroativa)
    case 'starter': return 'ME Start'
    case 'basic':   return 'MEI Plus'
  }
  return ''
}

// Buscar stripe_price_id direto na tabela planos
const { data: planoRow } = await supabase
  .from('planos')
  .select('id, stripe_price_id')
  .eq('nome', planoNome)
  .eq('ativo', true)
  .limit(1)
  .maybeSingle()
const priceId = planoRow?.stripe_price_id
```

### Go `apps/api/internal/billing/repository.go::FindStripePriceBySlug`

Mesmo padrão server-side. `slugToPlanoNome()` em Go espelha a versão TS — **MANTER OS DOIS EM SYNC** se adicionar plano novo.

## Metadata OBRIGATÓRIA no Checkout Session

```ts
const metadata = {
  plano_slug:   slug,         // 'start', 'premium', etc.
  plano_nome:   planoNome,    // 'ME Start', 'MEI Premium'
  tipo_empresa: owner.tipo,   // 'MEI' | 'ME' | 'EPP'
  plano_id:     planoUUID,    // uuid de planos.id
  ...(owner.kind === 'mei'      ? { mei_id:     owner.id } : {}),
  ...(owner.kind === 'empresa'  ? { empresa_id: owner.id } : {}),
}

// Enviar nos DOIS lugares — Stripe propaga separadamente:
body.set(`metadata[${k}]`, v)                          // checkout.session
body.set(`subscription_data[metadata][${k}]`, v)       // subscription
```

**Sem isso o webhook não consegue saber qual user/plano atualizar.** Foi exatamente o bug do commit `b484884`.

## Webhook handler — eventos obrigatórios

No Stripe Dashboard, garantir que o endpoint `notameigateway` tem:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### handleSubscription DEVE atualizar plano_id

```go
// Lê owner do metadata
empresaIDStr := sub.Metadata["empresa_id"]
meiIDStr     := sub.Metadata["mei_id"]
planoID, _   := uuid.Parse(sub.Metadata["plano_id"])

// Fallback: resolve plano_id via stripe_price_id se metadata faltar
if planoID == uuid.Nil && len(sub.Items.Data) > 0 {
    priceID := sub.Items.Data[0].Price.ID
    row := h.db.Pool().QueryRow(ctx, `
        SELECT id FROM planos WHERE stripe_price_id = $1 AND ativo = true LIMIT 1
    `, priceID)
    row.Scan(&planoID)
}

// UPDATE com 2-step (UPDATE → INSERT fallback pra competência sem row)
// updateSubscriptionByOwner em apps/api/internal/handler/stripe_webhook.go
```

**Anti-bug:** se metadata.plano_id for vazio E o stripe_price_id também não bater em planos table, o UPDATE não muda plano (mantém o atual). Nunca apagar plano por acidente.

### Trial bypass — desligar ao pagar

ME/EPP em trial tem `empresas.trial_me = true` (bypass de limite). Quando pagar:

```go
if empresaIDStr != "" {
    h.db.Pool().Exec(ctx, `UPDATE empresas SET trial_me = false WHERE id = $1`, empresaID)
}
```

### Cache invalidation — MEI E Empresa

```go
// Empresa path
if h.billingGrd != nil { h.billingGrd.InvalidateEmpresa(ctx, empresaID) }

// MEI path
if h.billingGrd != nil { h.billingGrd.InvalidateSubscriptionCache(ctx, meiID) }
```

BillingGuard cache tem TTL 5min — sem invalidate, o usuário leva até 5min pra ver plano novo.

## handleCheckoutCompleted — salvar customer pros 2 tipos

```go
if empresaIDStr := session.Metadata["empresa_id"]; empresaIDStr != "" {
    h.db.Pool().Exec(ctx, `UPDATE empresas SET stripe_customer_id = $1 WHERE id = $2`,
        customerID, empresaID)
} else if meiIDStr := session.Metadata["mei_id"]; meiIDStr != "" {
    h.db.Pool().Exec(ctx, `UPDATE meis SET stripe_customer_id = $1 WHERE id = $2`,
        customerID, meiID)
}
```

Sem isso, segundo checkout do mesmo user cria customer duplicado no Stripe.

## handleInvoicePaymentFailed — email pros 2 tipos

```go
// Tentar empresas primeiro (ME/EPP), fallback meis
row := db.Pool().QueryRow(ctx2, `
    SELECT e.email, e.razao_social
    FROM empresas e
    JOIN emissoes_mensais em ON em.empresa_id = e.id
    WHERE em.stripe_subscription_id = $1 LIMIT 1
`, subID)
if err := row.Scan(...); err != nil {
    // Fallback meis
    row = db.Pool().QueryRow(ctx2, `... FROM meis m JOIN emissoes_mensais em ON em.mei_id = m.id ...`, subID)
    row.Scan(...)
}
```

## Scripts utilitários (rodar pontual, não em CI)

| Script | Quando rodar |
|---|---|
| `scripts/stripe-catalog-rebuild.mjs` | Recriar catálogo do zero (com confirmação) |
| `scripts/stripe-finish-prices.mjs` | Após rebuild parcial (Stripe metered API breaking change pode interromper) |
| `scripts/stripe-fix-descriptions.mjs` | Após renomear produto ou trocar limite — sincroniza description no Checkout |
| `scripts/db-sync-planos.mjs` | Após mudança de catálogo Stripe — sincroniza planos table |

Todos exigem `STRIPE_SECRET_KEY=sk_live_...` + `SUPABASE_SERVICE_ROLE_KEY=eyJ...` no env.

## Checklist pra adicionar plano novo

- [ ] Criar produto + price no Stripe Dashboard (ou via `stripe-catalog-rebuild.mjs`)
- [ ] Rodar `stripe-fix-descriptions.mjs` com nova descrição
- [ ] Editar `scripts/db-sync-planos.mjs` adicionando linha do novo plano
- [ ] Rodar `node scripts/db-sync-planos.mjs` em prod
- [ ] Adicionar slug em `slugToPlanoNome()` (TS E Go — sync)
- [ ] Adicionar entrada em `PLANOS_MEI` ou `PLANOS_EMPRESA` em `/billing/page.tsx`
- [ ] Atualizar `PricingToggleMei` ou `PricingToggleMe` (landing)
- [ ] Rodar `scripts/qa-upgrade-flow.mjs` — deve continuar 54+ ok (ou adicionar caso novo)
- [ ] QA browser real: tela `/billing` → modal "Confirmar assinatura" → Stripe Checkout abre com nome+preço+desc corretos
