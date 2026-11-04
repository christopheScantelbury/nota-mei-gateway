# Webhooks do Stripe (conta LIVE)

> Revisado em 2026-11-04 (#260). A conta Stripe LIVE era compartilhada pelos
> produtos da ScantelburyDevs (NotaFácil, EventGear e ContentAI). EventGear e
> ContentAI foram apagados/pausados — os endpoints deles estão desativados e
> **só o endpoint de produção do NotaFácil está ativo**. Se um deles voltar
> nesta conta, cada endpoint recebe os eventos de todos — o handler de cada
> produto precisa ignorar o que não é dele.

## Endpoints

| ID | URL | Produto | Status |
|---|---|---|---|
| `we_1TUEZ6QkYQoRUOWmdRzkSGT0` | `https://api.emitirnotafacil.com.br/v1/webhooks/stripe` | **NotaFácil (produção)** | ✅ ativo |
| `we_1TRxmdQkYQoRUOWmWX1oxh2b` | `https://api-staging-production-eda6.up.railway.app/v1/webhooks/stripe` | NotaFácil staging | ⛔ desativado 2026-11-04 — serviço `api-staging` apagado; recebia eventos LIVE |
| `we_1TUEVUQkYQoRUOWmYVkw2dEc` | `https://api.notameigateway.com.br/v1/webhooks/stripe` | NotaFácil (domínio morto) | ⛔ desativado |
| `we_1TV9kEQkYQoRUOWm01rEbNiw` | `https://api-production-6757.up.railway.app/v1/billing/webhook` | EventGear | ⛔ desativado 2026-11-04 — produto fora do ar (404) |
| `we_1TNDz9QkYQoRUOWmsx3jX9yu` / `we_1TLenuQkYQoRUOWmFU2JhzAu` | `contentai-backend…/api/webhooks/stripe` | ContentAI | ⛔ desativados 2026-11-04 — produto fora do ar (404) |

## Eventos assinados pelo endpoint de produção

O handler é `apps/api/internal/handler/stripe_webhook.go`. A lista abaixo também
está em `apps/web/lib/monitor/stripe.ts` (`EVENTOS_ASSINADOS`) — **manter as três
iguais**.

| Evento | O que faz |
|---|---|
| `checkout.session.completed` | grava `stripe_customer_id` (meis/empresas) — evita customer duplicado |
| `customer.subscription.created` / `.updated` | ativa/troca plano em `emissoes_mensais`, desliga `trial_me`, recalcula a cota ao sair do trial (#257) |
| `customer.subscription.deleted` | volta o dono para o Trial |
| `invoice.paid` | renovação mensal |
| `invoice.payment_failed` | e-mail de pagamento falhou |
| `price.updated` / `price.deleted` / `product.updated` | sincroniza o catálogo `planos` (só preços/produtos do NotaFácil) |

## Como o NotaFácil ignora os outros produtos

- Assinaturas sem `metadata.empresa_id`/`mei_id` → ignoradas (log `warn`).
- `price.*`/`product.*` só mexem em `planos` com `stripe_price_id`/`stripe_product_id` iguais.
- Todo evento recebido com sucesso é gravado em `stripe_events` (dedupe) — inclusive os ignorados.

## Monitoramento (#259)

O monitor de hora em hora (`/api/cron/monitor-prod` → issues no GitHub) checa:

1. **4xx/5xx no webhook** — logs do Railway em `/v1/webhooks/*`.
2. **Evento não processado** — evento dos tipos acima criado há > 15 min que não está em `stripe_events`.
3. **Assinatura divergente** — assinatura ativa do NotaFácil no Stripe sem linha ativa em `emissoes_mensais`.

Corrigiu o webhook? Reenvie os eventos perdidos em Stripe Dashboard → Developers →
Webhooks → endpoint de produção → evento → **Resend**.

## Recomendações em aberto

- Se EventGear ou ContentAI voltarem, usar contas Stripe próprias em vez de
  reativar os endpoints nesta conta.
- Staging do NotaFácil, se voltar a existir, deve usar o **modo test**, nunca a conta LIVE.
