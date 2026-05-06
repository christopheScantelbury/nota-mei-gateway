# Nota MEI Gateway

[![CI](https://github.com/christopheScantelbury/nota-mei-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/christopheScantelbury/nota-mei-gateway/actions/workflows/ci.yml)
[![Deploy](https://github.com/christopheScantelbury/nota-mei-gateway/actions/workflows/deploy.yml/badge.svg)](https://github.com/christopheScantelbury/nota-mei-gateway/actions/workflows/deploy.yml)
[![Go 1.23+](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go)](https://go.dev/dl/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![License: Proprietary](https://img.shields.io/badge/license-proprietary-red)](./LICENSE)

> API REST em Go para emissão automatizada de NFS-e para MEI via Receita Federal Nacional — [ScantelburyDevs](https://scantelburydevs.com.br)

---

## Visão geral

**Nota MEI Gateway** é uma plataforma de emissão de Nota Fiscal de Serviço Eletrônica (NFS-e) voltada para Microempreendedores Individuais (MEI) brasileiros. O sistema expõe dois produtos:

| Produto | Público | URL |
|---------|---------|-----|
| **Nota Fácil MEI** | MEI que emite notas pelo painel web | `emitirnotafacil.com.br` |
| **Nota MEI Gateway** | Desenvolvedores que emitem via API REST | `emitirnotafacil.com.br` |

### O que o sistema faz

- Recebe uma requisição de emissão de NFS-e
- Gera o RPS (Recibo Provisório de Serviços) em XML conforme ABRASF
- Assina o XML com o certificado A1 do MEI (armazenado no AWS Secrets Manager)
- Envia para a **API da Receita Federal Nacional** via mTLS
- Persiste o resultado no Supabase (PostgreSQL)
- Entrega o status via **webhook** com assinatura HMAC-SHA256
- Disponibiliza PDF e XML para download

---

## Stack técnica

### Backend — `apps/api`
| Componente | Tecnologia |
|---|---|
| Linguagem | Go 1.23+ |
| Framework HTTP | Fiber v2 |
| Banco de dados | Supabase (PostgreSQL 15) |
| Cache / Rate limit | Redis |
| Fila de mensagens | RabbitMQ (CloudAMQP) |
| Certificados | AWS KMS + Secrets Manager |
| Assinatura XML | xmlsec1 (padrão ABRASF) |
| Deploy | Railway |

### Frontend — `apps/web`
| Componente | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | Supabase Auth (OTP por e-mail) |
| Estilização | Tailwind CSS |
| Deploy | Vercel |

### Billing
| Componente | Tecnologia |
|---|---|
| Pagamentos | Stripe Checkout + Customer Portal |
| Recorrência | Stripe Subscriptions (BRL, mensal) |
| Excedentes | Stripe Metered Billing |

---

## Estrutura do monorepo

```
nota-mei-gateway/
├── apps/
│   ├── api/                    # Go + Fiber → Railway
│   │   ├── cmd/server/         # Entry point API (porta 8080)
│   │   ├── cmd/worker/         # Webhook consumer (RabbitMQ)
│   │   ├── internal/
│   │   │   ├── auth/           # API Keys + middleware Bearer
│   │   │   ├── billing/        # BillingGuard + Stripe
│   │   │   ├── document/       # RPS builder + XMLDSig
│   │   │   ├── nfse/           # Adapter Receita Federal (mTLS)
│   │   │   └── webhook/        # Publisher + Consumer
│   │   └── pkg/
│   │       ├── cert/           # CertProvider (AWS Secrets Manager)
│   │       └── storage/        # S3Store para arquivos fiscais
│   └── web/                    # Next.js 14 → Vercel
│       ├── app/(dashboard)/    # Painel autenticado (SSR)
│       ├── app/(landing)/      # Landing page (SSG)
│       └── app/(onboarding)/   # Cadastro + Login
├── packages/
│   ├── sdk-node/               # SDK Node.js oficial
│   ├── sdk-python/             # SDK Python oficial
│   └── sdk-woo/                # Plugin WooCommerce
├── supabase/
│   └── migrations/             # Migrations SQL versionadas
├── docs/
│   ├── openapi.yaml            # Contrato OpenAPI 3.1
│   ├── architecture.md         # Diagrama de arquitetura
│   ├── qa-test-cases.md        # Casos de teste para QA
│   └── postman-collection.json # Collection Postman v2.1
└── .github/workflows/          # CI (lint + test) + CD (Railway + Vercel)
```

---

## Pré-requisitos

| Ferramenta | Versão mínima | Para quê |
|---|---|---|
| [Go](https://go.dev/dl/) | 1.23 | API backend |
| [Node.js](https://nodejs.org/) | 20 | Frontend + tooling |
| [Docker](https://docs.docker.com/get-docker/) + Compose v2 | qualquer | Redis + RabbitMQ local |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | 1.x | Banco de dados local |
| `golangci-lint` | latest | Lint (CI instala automaticamente) |

---

## Setup local

### 1. Clonar e instalar dependências Node

```bash
git clone https://github.com/christopheScantelbury/nota-mei-gateway.git
cd nota-mei-gateway
npm ci
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

Edite `.env` com os valores reais (Supabase, Stripe test keys, Redis, etc.).  
Veja `CLAUDE.md §6` para a lista completa de variáveis.

### 3. Subir infra local

```bash
make dev-stack       # Redis + RabbitMQ via Docker
make dev-supabase    # Supabase local (Studio em :54323, Postgres em :54322)
supabase db reset    # Aplica migrations + seed
```

### 4. Rodar API + web

```bash
make dev             # API Go em :8080 + Next.js em :3000
```

Ou separadamente:

```bash
# Só o frontend
cd apps/web && npm run dev

# Só a API Go
cd apps/api && go run ./cmd/server
```

---

## Comandos disponíveis

Execute `make help` para ver a lista completa. Os principais:

| Comando | Descrição |
|---------|-----------|
| `make dev` | Stack local completo (infra + API + web) |
| `make test` | Testes unitários (Go com `-race`) + web |
| `make lint` | Lint API (golangci-lint) + web (ESLint) |
| `make build` | Build API + web |
| `make migrate` | `supabase db push` (produção) |
| `make migrate-local` | `supabase db reset` (local) |
| `make openapi-lint` | Valida `docs/openapi.yaml` |
| `make openapi-types` | Gera `apps/web/lib/api-types.ts` |
| `make deploy-staging` | Deploy manual Railway staging + Vercel preview |
| `make deploy-prod` | Deploy manual produção (preferir merge em `main`) |
| `make rollback-api` | Rollback Railway produção |

---

## API — Contrato principal

Autenticação via `Authorization: Bearer sk_live_<hex64>` (API Keys geradas no painel).

```bash
# Emitir uma NFS-e
curl -X POST https://api.emitirnotafacil.com.br/v1/nfse \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "servico": {
      "codigo_nbs": "01.01.01.10",
      "discriminacao": "Desenvolvimento de software",
      "valor": 3500.00,
      "aliquota_iss": 2.0
    },
    "tomador": {
      "tipo": "PJ",
      "documento": "12345678000190",
      "razao_social": "Empresa Cliente LTDA",
      "email": "financeiro@empresa.com",
      "municipio_ibge": "3550308"
    },
    "competencia": "2026-05",
    "webhook_url": "https://erp.empresa.com/webhooks/nfse"
  }'
```

Resposta `202 Accepted`:

```json
{
  "nota_id": "uuid",
  "status": "PROCESSANDO",
  "mensagem": "Nota enviada para processamento"
}
```

Consulte `docs/openapi.yaml` para o contrato completo ou importe `docs/postman-collection.json` no Postman.

---

## SDKs oficiais

| SDK | Instalação |
|---|---|
| Node.js | `npm install @nota-mei/sdk` |
| Python | `pip install nota-mei-sdk` |
| WooCommerce | Plugin disponível em `packages/sdk-woo/` |
| Zapier | App disponível em `packages/sdk-zapier/` |
| Google Sheets | Add-on em `packages/sdk-sheets/` |

---

## Deploy (CI/CD)

O workflow `.github/workflows/deploy.yml` é acionado em push para `main` (produção) e `develop` (staging).

| Secret | Uso |
|---|---|
| `RAILWAY_TOKEN` | Deploy API produção (branch `main`) |
| `RAILWAY_TOKEN_STAGING` | Deploy API staging (branch `develop`) |
| `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` | Deploy web (`main` → prod, `develop` → preview) |

Deploy manual:

```bash
make deploy-prod     # Railway prod + Vercel prod
make deploy-staging  # Railway staging + Vercel preview
make rollback-api    # Rollback Railway produção
```

---

## Segurança

- **Certificado A1** — nunca armazenado em disco; carregado do AWS Secrets Manager em memória
- **API Keys** — apenas SHA-256 no banco; a chave real é exibida uma única vez no cadastro
- **Service Role Key** — exclusivamente server-side; nunca exposta ao cliente
- **Stripe Webhooks** — validados com `stripe.ConstructEvent` (assinatura HMAC)
- **RLS** — Row Level Security habilitado em todas as tabelas do Supabase
- **MEI isolamento** — todos os endpoints filtram por `mei_id` extraído do JWT

Para reportar vulnerabilidades, abra uma issue privada ou contate `security@scantelburydevs.com.br`.

---

## Documentação

| Documento | Local |
|---|---|
| Manifesto técnico | `CLAUDE.md` |
| Arquitetura | `docs/architecture.md` |
| OpenAPI 3.1 | `docs/openapi.yaml` |
| Mapeamento de erros da Receita | `docs/receita-erros.md` |
| Casos de teste QA | `docs/qa-test-cases.md` |
| Relatório de carga (k6) | `docs/load-test-report.md` |
| Deploy checklist | `docs/deploy-checklist.md` |

---

## Licença

Proprietário — © ScantelburyDevs. Todos os direitos reservados.  
Uso não autorizado é proibido. Veja [LICENSE](./LICENSE).
