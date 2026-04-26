# Arquitetura — Nota MEI Gateway

## Visão geral

```
[MEI / ERP]  →  API Gateway (Go/Fiber)  →  Receita Federal NFS-e
                      ↓
               [Supabase PostgreSQL]
                      ↓
               [RabbitMQ Worker]  →  Webhook entregue ao cliente
```

## Decisões de arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Linguagem | Go 1.23 | Performance, baixo custo de memória no Railway |
| HTTP | Fiber v2 | API simples, Express-like, bom suporte a middleware |
| Banco | Supabase (PG 15) | RLS nativo, Auth integrado, free tier generoso |
| Cache | Redis | Sliding window rate limiting, cache NBS |
| Fila | RabbitMQ (CloudAMQP) | Webhook engine assíncrono, retry automático |
| Certificados | AWS KMS + Secrets Manager | Compliance fiscal — cert A1 nunca em disco |

## Fluxo de emissão

1. Cliente chama `POST /v1/nfse` com Bearer token
2. Middleware valida API Key (hash SHA-256 no banco)
3. BillingGuard verifica limite do plano no Redis
4. API monta RPS XML, assina com certificado A1 (via AWS Secrets)
5. Envia para Receita Federal (mTLS)
6. Salva status `PROCESSANDO` no banco
7. Publica evento no RabbitMQ
8. Worker consome e entrega webhook ao cliente
9. Worker atualiza status para `AUTORIZADA` ou `REJEITADA`

## Segurança

- Certificado A1 sempre em memória, nunca em disco
- API Key real nunca no banco — apenas SHA-256
- RLS habilitado em todas as tabelas
- Stripe Webhook validado com `ConstructEvent`
- Service Role Key nunca exposta no cliente
