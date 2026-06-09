---
name: nota-mei-conventions
description: Padrões gerais do projeto Nota MEI Gateway — estrutura do monorepo, convenções Go/Next.js, PT-BR, formato de erros, status fiscais. Use SEMPRE que criar/editar código do projeto.
---

# Nota MEI Gateway — Convenções gerais

ScantelburyDevs · monorepo `apps/api` (Go + Fiber) + `apps/web` (Next.js 14 App Router) + Supabase (PostgreSQL 15) + Stripe LIVE + Receita Federal NFS-e Nacional v1.01.

## Estrutura do monorepo

```
apps/
  api/                  # Go 1.23 + Fiber v2 → Railway
    cmd/server/main.go  # entry da API HTTP
    cmd/worker/main.go  # entry do consumer RabbitMQ
    internal/
      auth/             # API Keys + middleware híbrido (Bearer + JWT)
      billing/          # BillingGuard + repository
      document/         # RPS builder + XMLDSig (RSA-SHA256)
      nfse/             # adapter Receita Federal (mTLS)
      handler/          # handlers HTTP Fiber
      webhook/          # publisher + consumer RabbitMQ
    pkg/{cert,stripe,supabase,email,...}/
  web/                  # Next.js 14 App Router → Vercel
    app/(landing)/      # landing pública (SSG)
    app/(dashboard)/    # dashboard autenticado (SSR)
    app/(onboarding)/   # cadastro MEI/ME/EPP
    app/api/            # Route Handlers (Edge/Node)
    app/auth/callback/  # OAuth/Magic Link callback (rota crítica)
    components/
      ui/               # shadcn/ui base
      dashboard/        # Sidebar, PlanGate, etc.
      landing/          # Hero, PricingToggle*, etc.
    lib/
      plans.ts          # ⚠️ ÚNICA fonte de feature matrix — usar sempre `hasFeature()`
      plan-tier.ts      # PlanTier resolver + features helper (Sidebar)
      supabase/         # createClient (browser/server/admin)
      stripe/           # client wrapper
      tributario/       # regras Simples/LP/LR
scripts/
  qa-upgrade-flow.mjs   # smoke test programático (54/54 ok)
  qa-persona.sh         # toggle persona MEI/ME-SN/ME-LP/EPP-LR + magic link
  stripe-*.mjs          # scripts Stripe catalog/descriptions
  db-sync-planos.mjs    # sync planos table com Stripe catalog
supabase/
  config.toml           # ⚠️ Dashboard prod ainda precisa ser editado manual
  migrations/           # .sql versionados, aplicados via `supabase db push`
```

## Go — convenções (apps/api/)

**Erros sentinel tipados** (nunca string raw):
```go
type ErrNotFound struct{ Resource string }
func (e ErrNotFound) Error() string { return fmt.Sprintf("%s not found", e.Resource) }
```

**Context sempre propagar** (nunca `context.TODO()` fora de testes):
```go
func (s *Service) EmitirNota(ctx context.Context, req EmissaoRequest) (*Nota, error)
```

**Logger zerolog estruturado** (campos tipados, nunca `Msgf`):
```go
log.Ctx(ctx).Info().
    Str("mei_id", meiID).
    Str("nota_id", notaID).
    Msg("nota enviada para Receita")
```

**Nunca** `panic` fora do startup. Nunca `init()` pra lógica de negócio. Sempre `defer` pra fechar recursos.

**Fiber HTTP responses padronizadas:**
```go
// Sucesso
return c.Status(fiber.StatusCreated).JSON(fiber.Map{
    "nota_id": nota.ID, "status": nota.Status,
})

// Erro — SEMPRE este formato
return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
    "error":      "VALIDATION_ERROR",
    "message":    "campos inválidos",
    "fields":     erros, // opcional []FieldError
    "request_id": c.Locals("request_id"),
})
```

**Códigos de erro padronizados** (use exatamente esses strings):
| Code | HTTP |
|---|---|
| `INVALID_API_KEY` | 401 |
| `PLAN_LIMIT_REACHED` | 402 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `ALREADY_CANCELLED` | 409 |
| `VALIDATION_ERROR` | 422 |
| `RECEITA_REJECTION` | 422 |
| `INSCRICAO_MUNICIPAL_OBRIGATORIA` | 422 |
| `NO_ACCOUNT` | 404 |
| `INTERNAL_ERROR` | 500 |

## Next.js — convenções (apps/web/)

**Default Server Components** — só `'use client'` quando precisa de hook/handler interativo.
**Buscar dados no servidor** — nunca expor service role key no cliente.
**`createServerClient()`** em Server Components; **`createBrowserClient()`** em Client Components.
**`createAdminClient()`** (service role) só em Route Handlers que precisam bypass RLS.

**Feature gating SEMPRE via `hasFeature()`** — nunca matriz literal. Ver skill `nota-mei-plan-gating`.

**Toast feedback** — usar `lib/notify.ts` (wrapper Sonner). Erros fazem scroll-to-top automático.

## Banco — invariantes

**ARCH-03**: pra MEI legacy, `meis.id == empresas.id == auth.users.id`. Empresa MEI tem `tipo='MEI'` apontando pro mesmo ID. Notas MEI têm `mei_id != NULL`, ME/EPP têm `mei_id = NULL, empresa_id != NULL`.

**RLS habilitado em TODAS as tabelas** — sem exceção. Service role bypass só em rotas controladas (callback first-login, webhook stripe, admin).

**Queries de listagem que precisam pegar nota MEI E ME**:
```sql
WHERE (mei_id = $1 OR empresa_id = $1)
```

## Status fiscais (nunca alterar a grafia)

```
PROCESSANDO    → amarelo (#F0B414) com pulse
AUTORIZADA     → verde (#00C85A)
REJEITADA     → vermelho (#FF3232)
CANCELADA     → cinza (#6473A0)
ERRO_TEMPORARIO → laranja (transient, retry)
```

## PT-BR sempre

Todo texto user-facing em **português do Brasil**, claro e não-técnico.
- "Configurações" → "Minha empresa"
- "Webhooks" → "Notificações automáticas"
- "API Keys" → "Chaves de API"
- "Recorrências" → "Notas Recorrentes" / "Automações"
- "Templates" → "Modelos de Nota"

Mensagens de erro **acionáveis**:
- ❌ "Validation failed"
- ✅ "Inscrição Municipal obrigatória — cadastre em Minha empresa → Dados"

## Segurança — regras inegociáveis

1. **Cert A1 nunca em disco** — sempre via AWS Secrets Manager
2. **API Key real nunca no banco** — apenas SHA-256
3. **Service Role Key nunca no cliente** — apenas server-side
4. **Stripe Webhook** — sempre validar assinatura com `stripe.ConstructEvent`
5. **Variáveis de ambiente** nunca hardcoded
6. **Logs** nunca conter certificados/senhas/chaves
7. **Isolamento MEI/empresa** — todo endpoint filtra por owner do contexto
8. **Magic link** — apenas `/auth/callback` aceita auth (ver skill `nota-mei-auth`)

## Política de deploys batched (custo Railway+Vercel)

Ver skill `nota-mei-deploy-qa`. Resumo:
- Vercel `ignoreCommand` ativo — só builda se `apps/web/**` mudar
- Railway `watchPatterns` ativo — só builda se `apps/api/**` mudar
- Acumular commits antes de pushar
- Separar commits por área (`docs:` ou `chore(memory):` skipados automaticamente)
