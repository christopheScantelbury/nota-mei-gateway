# Deploy Checklist — Nota MEI Gateway

> Execute este checklist **antes de cada deploy para produção**.  
> Todos os itens devem estar ✅ para o deploy avançar.

---

## 1. Código

- [ ] `main` está atualizada e CI passa (Go lint + test, Next.js build)
- [ ] Não há `TODO: replace` ou `FIXME` críticos no caminho crítico
- [ ] `NoopSigner` substituído por implementação XMLDSig real antes do go-live
- [ ] Sem segredos/chaves hardcoded (grep por `sk_live_`, `whsec_`, `eyJ`)
- [ ] `go build ./...` + `go vet ./...` sem erros localmente

## 2. Banco de dados

- [ ] Migrations aplicadas em produção (`supabase db push`)
- [ ] RLS habilitado em **todas** as tabelas (verificar via Supabase Dashboard)
- [ ] Seed de planos executado (`supabase db push --include-seed`)
- [ ] Backup automático ativo no Supabase (confirmar em Supabase → Settings → Database)
- [ ] Índices críticos existem (verificar `\d notas_fiscais` no psql)

## 3. Variáveis de ambiente — Railway (API + Worker)

| Variável                | Checado |
|-------------------------|---------|
| `DATABASE_URL`          | [ ]     |
| `SUPABASE_SERVICE_ROLE_KEY` | [ ] |
| `REDIS_URL`             | [ ]     |
| `RABBITMQ_URL`          | [ ]     |
| `AWS_REGION`            | [ ]     |
| `AWS_ACCESS_KEY_ID`     | [ ]     |
| `AWS_SECRET_ACCESS_KEY` | [ ]     |
| `AWS_KMS_KEY_ARN`       | [ ]     |
| `STRIPE_SECRET_KEY`     | [ ]     |
| `STRIPE_WEBHOOK_SECRET` | [ ]     |
| `STRIPE_PRICE_STARTER`  | [ ]     |
| `STRIPE_PRICE_BASIC`    | [ ]     |
| `STRIPE_PRICE_PRO`      | [ ]     |
| `STRIPE_PRICE_BUSINESS` | [ ]     |
| `RECEITA_API_URL`       | [ ]     |
| `WEBHOOK_HMAC_SECRET`   | [ ]     |
| `APP_ENV=production`    | [ ]     |
| `LOG_LEVEL=info`        | [ ]     |

## 4. Variáveis de ambiente — Vercel (Web)

| Variável                          | Checado |
|-----------------------------------|---------|
| `NEXT_PUBLIC_API_URL`             | [ ]     |
| `NEXT_PUBLIC_SUPABASE_URL`        | [ ]     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | [ ]     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [ ] |

## 5. Integrações externas

- [ ] **AWS Secrets Manager** — certificado de teste carregado e acessível
- [ ] **Stripe** — produto e preços criados em modo live; IDs copiados para env vars
- [ ] **Stripe webhook** — endpoint `https://api.emitirnotafacil.com.br/v1/webhooks/stripe` registrado; eventos: `customer.subscription.*`
- [ ] **CloudAMQP** — fila `nfse.webhook.delivery` declarada e acessível
- [ ] **Receita Federal** — URL de produção configurada (`RECEITA_API_URL`)

## 6. Saúde dos serviços

```bash
# API health
curl https://api.emitirnotafacil.com.br/v1/health
# Esperado: {"status":"ok","env":"production"}

# Worker logs (Railway)
railway logs --service worker --tail
# Esperado: "nfse poller started", "webhook consumer started", "webhook requeuer started"
```

- [ ] `/v1/health` retorna `{"status":"ok"}`
- [ ] Worker inicia sem erros (poller + consumer + requeuer)
- [ ] Redis acessível (billing guard não loga erros)
- [ ] RabbitMQ conectado (publisher não loga erros)

## 7. Smoke test pós-deploy

```bash
# Substitua <API_KEY> por uma chave sk_live_ válida
curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "servico": {
      "codigo_nbs": "01.01.01.10",
      "discriminacao": "Teste pós-deploy",
      "valor": 100.00,
      "aliquota_iss": 2.0
    },
    "tomador": {
      "tipo": "PJ",
      "documento": "12345678000190",
      "razao_social": "Empresa Smoke Test"
    },
    "competencia": "'"$(date +%Y-%m)"'"
  }'
# Esperado: 202 Accepted com nota_id
```

- [ ] Smoke test retorna `202` com `nota_id`
- [ ] Nota aparece como `PROCESSANDO` no dashboard
- [ ] Log do worker mostra consulta à Receita Federal

## 8. Monitoramento

- [ ] Grafana dashboard importado e mostrando métricas
- [ ] Alerta de error rate > 5% configurado
- [ ] Alerta de p99 latency > 2 s configurado
- [ ] Alerta de fila RabbitMQ > 1000 mensagens configurado

## 9. Rollback

Se algo der errado após o deploy:

```bash
# API / Worker — Railway
railway rollback --service api
railway rollback --service worker

# Web — Vercel
vercel rollback
```

- [ ] Procedimento de rollback documentado e testado
- [ ] Equipe ciente do deploy e disponível por 2 h após a janela

---

**Aprovado por:** ___________________  **Data:** ___________
