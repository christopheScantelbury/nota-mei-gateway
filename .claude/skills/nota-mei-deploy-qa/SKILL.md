---
name: nota-mei-deploy-qa
description: Workflow de deploys batched (Vercel ignoreCommand + Railway watchPatterns) e processo de QA (smoke test programático + cenários browser). Use SEMPRE que for fazer commit/push, rodar QA, ou disparar deploy manual no Railway/Vercel.
---

# Deploys batched + QA workflow

## Política de deploys batched — economia Railway+Vercel

**Razão**: Railway cobra build minutes + container time. Vercel Hobby tem 100 build-min/mês. Cada `git push` é billing event. Otimizar = poupa dinheiro real.

### Filtros automáticos (já configurados)

| Plataforma | Mecanismo | Arquivo |
|---|---|---|
| **Vercel** | `ignoreCommand` no `vercel.json` | `apps/web/vercel.json` + `.vercel-ignore-build.sh` |
| **Railway** | `watchPatterns` no `railway.toml` | raiz + `apps/api/railway.toml` |

### Tabela do que dispara cada plataforma

| Commit toca em… | Vercel builda? | Railway builda? |
|---|---|---|
| `apps/web/**` (React/Next.js) | ✅ | ⛔ skip |
| `apps/api/**` (Go) | ⛔ skip | ✅ |
| `docs/**`, `memory/**`, `*.md` | ⛔ skip | ⛔ skip |
| `supabase/migrations/**` | ⛔ skip | ⛔ skip (rodar `supabase db push` manual) |
| `scripts/**` | ⛔ skip | ⛔ skip |
| `apps/web/vercel.json` ou `railway.toml` | ✅ | ✅ |

### Convenções de commit pra economizar

1. **Acumular mudanças antes de pushar** — 1 push/dia > 5 pushes/dia.
2. **Separar commits por área**: `docs:`, `chore(memory):` são skippados.
3. **NÃO misturar** `apps/api` + `apps/web` no mesmo commit a menos que necessário.
4. **Migrations aplicam-se manualmente** via `supabase db push` — não dependem de deploy.

### Como pushar economizando

```bash
# Commits independentes
git add apps/api/internal/handler/billing.go
git commit -m "fix(billing): ..."

git add apps/web/app/api/billing/checkout/route.ts
git commit -m "fix(checkout): ..."

git add docs/qa-agent-prompt.md scripts/qa-upgrade-flow.mjs
git commit -m "test(qa): ..."  # ← este último NÃO dispara nenhum build

git push origin main   # Railway builda 1x (commit Go), Vercel builda 1x (commit web)
```

## Workaround: api production sem auto-deploy

O serviço `api` production no Railway às vezes fica com "Auto deploy unavailable" mesmo com repo conectado. Sintoma: push em main, worker+staging rebuildam, mas api prod fica no commit antigo.

### Verificar último commit deployado

```bash
RT=$(grep -m1 "RAILWAY_TOKEN=" /c/Users/Chris/Documents/claude/nota-mei-gateway/ACESSOS.local.md | grep -oE "[a-f0-9-]{36}" | head -1)
PROJ_ID="25988fa0-9393-462f-b57e-8780f2ca138e"
curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Project-Access-Token: $RT" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query{project(id:\\\"$PROJ_ID\\\"){services{edges{node{name deployments(first:1){edges{node{status meta}}}}}}}}\"}"
```

### Disparar deploy manual com commit específico

```bash
RT=...
API_SVC="fc34b8ba-8580-444e-9418-e9d1a0ca38ee"
ENV_PROD="ed8bd1f0-1416-4fad-b90f-d5666ae99ea7"
SHA="<git rev-parse --short HEAD>"

curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Project-Access-Token: $RT" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation{serviceInstanceDeploy(serviceId:\\\"$API_SVC\\\",environmentId:\\\"$ENV_PROD\\\",commitSha:\\\"$SHA\\\")}\"}"
```

### Monitorar o deploy

```bash
# Use Monitor com until-loop (não chain de sleeps)
until curl -s -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Project-Access-Token: $RT" \
  -d "{\"query\":\"query{project(id:\\\"$PROJ_ID\\\"){services{edges{node{name deployments(first:1){edges{node{status}}}}}}}}\"}" \
  | grep -q SUCCESS; do sleep 10; done
echo "ok"
```

## QA workflow

### Etapa 1 — Smoke test programático ANTES de QA UI

```bash
SK=$(grep -m1 "^STRIPE_SECRET_KEY=sk_live" ACESSOS.local.md | sed -E 's/^STRIPE_SECRET_KEY=([^ ]+).*/\1/')
SRK=$(sed -n '540p' ACESSOS.local.md | cut -d'=' -f2)
STRIPE_SECRET_KEY=$SK SUPABASE_SERVICE_ROLE_KEY=$SRK node scripts/qa-upgrade-flow.mjs
```

**Resultado esperado: 54 ok / 0 fail.** Se falhar, NÃO prossiga pra UI — banco/Stripe estão fora de sync.

Cobre:
1. Catálogo Stripe (9 produtos com descriptions corretas)
2. Banco planos (10 ativos com stripe_price_id setado)
3. API `/v1/health` (db, redis, rabbitmq, receita, stripe)
4. AI endpoint removido (comportamento idêntico a rota inexistente)
5. Slug resolution (11 cases)
6. PlanGate tier resolution (16 cases)
7. Plano dos admins (christophe MEI Premium + scantelburydevs ME Business)

### Etapa 2 — QA UI no browser (Chrome MCP)

22 cenários documentados em `docs/qa-agent-prompt.md` (CT-01 a CT-22). Spawnar agente em sessão dedicada:

```bash
# Opção: claude --append-system-prompt "$(cat docs/qa-agent-prompt.md | awk '/^<<<$/{f=1;next}/^>>>$/{f=0}f')"
```

Cenários novos do pacote 2026-06-05:
- **CT-19** upgrade end-to-end (cartão teste `4242 4242 4242 4242`)
- **CT-20** matriz de gating todos os 10 planos
- **CT-21** AI endpoint removido (DevTools fetch)
- **CT-22** Inactivity timeout 24h (config dashboard)

### Etapa 3 — Personas via magic link admin

```bash
# Toggle persona + magic link automático
SUPABASE_SERVICE_ROLE_KEY=... DEV_ADMIN_TOKEN=... ./scripts/qa-persona.sh me-sn

# Magic link manual pra qualquer email
curl -s -X POST https://www.emitirnotafacil.com.br/api/dev/magic-link \
  -H "Authorization: Bearer $DEV_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@scantelburydevs.com.br"}'
```

Action_link retornado funciona em janela anônima (cookies novos). Se já tem sessão de outro user, limpar via DevTools console:

```js
document.cookie.split(";").forEach(c => {
  const name = c.split("=")[0].trim()
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.emitirnotafacil.com.br`
})
localStorage.clear(); sessionStorage.clear()
```

## Quando rodar `supabase db push`

Migrations em `supabase/migrations/*.sql` **não disparam deploy nenhum**. Aplicação em prod é manual:

```bash
cd /c/Users/Chris/Documents/claude/nota-mei-gateway
supabase db push  # confirma antes de aplicar
```

Sempre rodar smoke test depois pra confirmar que banco continua consistente.

## Cenários onde deploy manual é justificável

| Cenário | Comando |
|---|---|
| Env var Vercel nova requer redeploy | `vercel --prod --force` (ou Dashboard) |
| Api production não auto-deployou | mutation GraphQL Railway com `commitSha` |
| Suspeita de imagem cacheada | `railway up` (CLI) ou Redeploy no Dashboard |

## Tokens necessários (no `ACESSOS.local.md`)

| Token | Uso |
|---|---|
| `STRIPE_SECRET_KEY` (sk_live_...) | Stripe API, scripts catalog/descriptions |
| `SUPABASE_SERVICE_ROLE_KEY` (eyJ...) | Queries server-side via REST |
| `RAILWAY_TOKEN` (uuid) | GraphQL `backboard.railway.app/graphql/v2` |
| `DEV_ADMIN_TOKEN` (hex64) | `/api/dev/magic-link` admin |
| `SUPABASE_ACCESS_TOKEN` (sbp_...) | Management API (templates email, sessions config) |

**Nunca** commit token. ACESSOS.local.md está no .gitignore.
