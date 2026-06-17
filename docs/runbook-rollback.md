# Runbook de Rollback — Nota MEI Gateway

> Procedimento operacional pra reverter deploys problemáticos em prod.
> Issue #229. Testar uma vez antes do hard launch (em `api-staging`).

## Decisão: ROLLBACK vs FIX FORWARD

| Situação | Ação |
|---|---|
| Deploy quebrou /health, prod fora do ar > 5min | ROLLBACK imediato |
| Bug afeta < 10% dos requests, fix < 30min disponível | FIX FORWARD |
| Bug fiscal grave (emissão errada, dados vazando) | ROLLBACK imediato |
| Bug visual/UX, sem impacto financeiro | FIX FORWARD |
| Bug em feature nova não-anunciada | feature flag OFF se possível |

## 1. Rollback Vercel (frontend Next.js)

**Tempo:** ~30s. Sem rebuild.

1. https://vercel.com/dashboard → projeto `nota-mei-gateway-web`
2. **Deployments** → encontrar último deploy SUCCESS antes do problemático
3. Clica `⋯` (três pontinhos) → **Promote to Production**
4. Confirma — o deployment anterior vira o atual

Validação:
```bash
curl -I https://www.emitirnotafacil.com.br/home | grep -i "x-vercel-deployment-url"
```

## 2. Rollback Railway (backend Go API)

**Tempo:** ~1-2min (precisa novo container).

### Via Dashboard
1. https://railway.app → projeto `nota-mei-gateaway`
2. Serviço **api** → **Deployments**
3. Encontrar último SUCCESS antes do problemático
4. `⋯` → **Redeploy**

### Via CLI
```bash
RAILWAY_TOKEN=<token>
PROJ="25988fa0-9393-462f-b57e-8780f2ca138e"
API_SVC="fc34b8ba-8580-444e-9418-e9d1a0ca38ee"
ENV_PROD="ed8bd1f0-1416-4fad-b90f-d5666ae99ea7"
LAST_GOOD_SHA="<sha curto>"

curl -X POST "https://backboard.railway.app/graphql/v2" \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation{serviceInstanceDeploy(serviceId:\\\"$API_SVC\\\",environmentId:\\\"$ENV_PROD\\\",commitSha:\\\"$LAST_GOOD_SHA\\\")}\"}"
```

Validação:
```bash
curl -s https://api.emitirnotafacil.com.br/v1/health | jq
```

## 3. Rollback Supabase (banco)

**Tempo:** ~5-15min dependendo da migration.

### Migration nova quebrou tudo
Cada migration sob `supabase/migrations/` deve ter o DOWN script comentado
no topo. Caso não tenha:

1. Identificar a migration problemática: `\d table_que_quebrou` no SQL Editor
2. Escrever DOWN ad-hoc:
   ```sql
   DROP TABLE IF EXISTS <nome>;  -- ou
   ALTER TABLE <tabela> DROP COLUMN IF EXISTS <coluna>;
   ```
3. Rodar no SQL Editor (Supabase Dashboard)
4. **NÃO** deletar o arquivo `.sql` — só reverter o estado do banco

### Dados corrompidos
1. Pra restore completo: Settings → Database → Backups → restore point-in-time (até 7 dias)
2. Pra restore parcial: identificar tabelas afetadas + SQL manual com snapshot

## 4. Rollback Stripe

**NÃO se aplica** — Stripe é fonte de verdade de billing. NÃO rollback price/product.

Se um plano foi criado/editado errado:
1. Stripe Dashboard → arquivar price errado
2. /admin/planos → forçar resync via UI
3. NUNCA deletar Stripe customer existente

## 5. Cache invalidation pós-rollback

Após qualquer rollback de backend:
- BillingGuard cache: auto-expira em 5min, ou:
  ```bash
  # via Railway CLI
  railway run --service redis redis-cli FLUSHDB
  ```
- Next.js ISR cache: deploy do Vercel já limpa automaticamente

## 6. Comunicação

**Durante incident:**
1. Mensagem inicial WhatsApp: "Issue detectada em prod, investigando — atualizo em 15min"
2. A cada 30min sem resolução: novo update
3. Pós-resolução: post-mortem em <24h

**Canais:**
- WhatsApp Chris (Owner): +55 11 9XXXX-XXXX
- Email backup: christophescantelbury@gmail.com
- Stripe issues: dashboard.stripe.com → suporte chat

## 7. Validação Hard Launch — checklist

Testar UMA vez em `api-staging` antes do hard launch:
- [ ] Rollback Vercel (deploy intencional ruim → promote anterior)
- [ ] Rollback Railway api-staging (mesmo procedimento)
- [ ] Migration UP + DOWN em staging
- [ ] Validar `/v1/health` retorna OK pós rollback

## Histórico

| Data | Incident | Ação | Duração |
|---|---|---|---|
| (pendente — primeiro rollback ainda não aconteceu) | | | |
