# CLAUDE.md — Nota MEI Gateway
> Manifesto de desenvolvimento para Claude Code · ScantelburyDevs

---

## 1. IDENTIDADE DO PROJETO

**Produto:** Nota MEI Gateway  
**Empresa:** ScantelburyDevs  
**Tagline:** Build · Migrate · Innovate  
**Slogan:** Seu código. Nossa precisão.  
**Descrição:** API REST em Go para emissão automatizada de NFS-e para MEI via Receita Federal Nacional.

---

## 2. STACK TÉCNICA — DECISÕES FINAIS

### Backend (API principal)
| Componente | Tecnologia | Motivo |
|---|---|---|
| Linguagem | **Go 1.23+** | Performance, baixo custo de memória no Railway |
| Framework HTTP | **Fiber v2** | API simples, middlewares prontos, inspirado no Express |
| Banco de dados | **Supabase** (PostgreSQL 15) | Gerenciado, RLS nativo, Storage incluso, free tier |
| Cache / Rate limit | **Redis** (Railway add-on) | Sliding window, BillingGuard, cache NBS |
| Fila de mensagens | **CloudAMQP** (RabbitMQ free) | Webhook engine, 1M msg/mês grátis |
| Certificados | **AWS KMS + Secrets Manager** | Compliance fiscal, certificados A1 nunca em disco |
| Assinatura XML | **xmlsec1** (binding Go) | Padrão ABRASF para NFS-e Nacional |
| Validação NFS-e | **Receita Federal API** (NFS-e Nacional v1.2) | API oficial, mTLS obrigatório |

### Frontend (Dashboard + Landing)
| Componente | Tecnologia |
|---|---|
| Framework | **Next.js 14** (App Router) |
| Deploy | **Vercel** (Hobby → Pro quando necessário) |
| Auth (humanos) | **Supabase Auth** (Magic Link) |
| Auth (máquinas) | **API Keys** sk_live_ / sk_test_ |
| Estilização | **Tailwind CSS** + design tokens NotaFácil |

### Billing
| Componente | Tecnologia |
|---|---|
| Pagamentos | **Stripe** (Checkout + Customer Portal + Webhooks) |
| Billing recorrente | Stripe Subscriptions (BRL, mensal) |
| Excedentes | Stripe Metered Billing (por nota acima do limite) |

### Infra / Deploy
| Serviço | Plataforma | Custo estimado MVP |
|---|---|---|
| API Go | **Railway** | ~$10-20/mês |
| Webhook Worker | **Railway** (serviço separado) | ~$2-5/mês |
| Banco + Auth + Storage | **Supabase** | $0 (free) → $25/mês (pro) |
| Dashboard + Landing | **Vercel** | $0 (hobby) → $20/mês (pro) |
| Redis | **Railway add-on** | ~$3/mês |
| RabbitMQ | **CloudAMQP free** | $0 |
| Métricas | **Grafana Cloud free** | $0 |
| Certificados | **AWS KMS + Secrets Manager** | ~$1-2/mês |
| **Total MVP** | | **~$16-50/mês** |

---

## 3. ESTRUTURA DO MONOREPO

```
nota-mei-gateway/
├── apps/
│   ├── api/                        # Go + Fiber → Railway
│   │   ├── cmd/
│   │   │   ├── server/main.go      # Entry: API principal (porta 8080)
│   │   │   └── worker/main.go      # Entry: Webhook consumer RabbitMQ
│   │   ├── internal/
│   │   │   ├── auth/               # API Keys, middleware Bearer
│   │   │   ├── billing/            # BillingGuard, contadores, Stripe
│   │   │   ├── document/           # RPS builder, assinatura XML
│   │   │   ├── nfse/               # Adapter Receita Federal (mTLS)
│   │   │   ├── webhook/            # Publisher + Consumer RabbitMQ
│   │   │   └── config/             # Carregamento de variáveis de ambiente
│   │   ├── pkg/
│   │   │   ├── cert/               # Interface CertProvider (AWS Secrets)
│   │   │   ├── stripe/             # Cliente Stripe wrapper
│   │   │   └── supabase/           # Cliente Supabase (pgx pool)
│   │   ├── go.mod                  # módulo: github.com/christopheScantelbury/nota-mei-gateway/api
│   │   ├── go.sum
│   │   ├── Dockerfile              # multi-stage: builder + runtime alpine
│   │   └── railway.toml            # configuração Railway declarativa
│   └── web/                        # Next.js 14 → Vercel
│       ├── app/
│       │   ├── (landing)/          # Landing page pública (SSG)
│       │   │   └── page.tsx
│       │   ├── (dashboard)/        # Dashboard autenticado (SSR)
│       │   │   ├── layout.tsx      # verifica sessão Supabase
│       │   │   ├── notas/
│       │   │   └── billing/
│       │   └── (onboarding)/       # Cadastro de MEI
│       │       └── cadastro/
│       ├── components/
│       │   ├── ui/                 # shadcn/ui componentes base
│       │   └── nota/               # componentes específicos do produto
│       ├── lib/
│       │   ├── supabase/           # createServerClient + createBrowserClient
│       │   └── stripe/             # loadStripe helper
│       ├── public/
│       │   └── brand/              # logos, ícones da identidade visual
│       ├── package.json
│       └── next.config.ts
├── supabase/
│   ├── migrations/                 # arquivos .sql versionados
│   ├── seed.sql                    # dados iniciais (planos, NBS sample)
│   └── config.toml                 # supabase CLI config
├── docs/
│   ├── architecture.md             # diagrama e decisões de arquitetura
│   ├── receita-erros.md            # mapeamento de códigos de rejeição
│   ├── postman-collection.json     # collection Postman v2.1
│   └── load-test-report.md         # resultado dos testes k6
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint + test (todo PR)
│       └── deploy.yml              # deploy Railway + Vercel (merge)
├── turbo.json                      # Turborepo pipelines
├── package.json                    # root workspace
├── Makefile                        # comandos unificados
└── CLAUDE.md                       # este arquivo
```

---

## 4. MODELO DE DADOS (Supabase / PostgreSQL)

### Tabelas principais

```sql
-- MEIs cadastrados
CREATE TABLE meis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj                  VARCHAR(14) UNIQUE NOT NULL,
  razao_social          VARCHAR(255) NOT NULL,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  municipio_ibge        VARCHAR(7) NOT NULL,
  cert_secret_arn       TEXT,                          -- AWS Secrets Manager ARN
  stripe_customer_id    VARCHAR(255) UNIQUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys para autenticação B2B
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id      UUID REFERENCES meis(id) ON DELETE CASCADE,
  key_hash    VARCHAR(64) UNIQUE NOT NULL,             -- SHA-256 da chave real
  key_prefix  VARCHAR(10) NOT NULL,                    -- sk_live_ ou sk_test_
  label       VARCHAR(100),
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Planos disponíveis
CREATE TABLE planos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                VARCHAR(50) NOT NULL,            -- Trial, Starter, Basic, Pro, Business
  emissoes_limite     INTEGER NOT NULL,
  preco_mensal_brl    DECIMAL(10,2),
  preco_excedente_brl DECIMAL(10,4),
  stripe_price_id     VARCHAR(255),
  stripe_product_id   VARCHAR(255),
  ativo               BOOLEAN DEFAULT true
);

-- Assinaturas ativas por MEI
CREATE TABLE emissoes_mensais (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id                      UUID REFERENCES meis(id) ON DELETE CASCADE,
  plano_id                    UUID REFERENCES planos(id),
  competencia                 VARCHAR(7) NOT NULL,     -- AAAA-MM
  total_emitidas              INTEGER DEFAULT 0,
  stripe_subscription_id      VARCHAR(255),
  stripe_subscription_status  VARCHAR(50),             -- active, past_due, canceled
  stripe_subscription_item_id VARCHAR(255),            -- para metered billing
  renovacao_em                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mei_id, competencia)
);

-- Notas fiscais emitidas
CREATE TABLE notas_fiscais (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id              UUID REFERENCES meis(id) ON DELETE RESTRICT,
  numero_rps          BIGINT NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PROCESSANDO',
                      -- PROCESSANDO | AUTORIZADA | REJEITADA | CANCELADA | ERRO_TEMPORARIO
  protocolo_receita   VARCHAR(100),
  numero_nfse         VARCHAR(50),
  codigo_verificacao  VARCHAR(50),
  xml_enviado         TEXT,
  xml_retorno         TEXT,
  pdf_path            TEXT,                            -- Supabase Storage path
  webhook_url         TEXT,
  webhook_entregue    BOOLEAN DEFAULT false,
  webhook_tentativas  INTEGER DEFAULT 0,
  idempotency_key     VARCHAR(255) UNIQUE,
  tomador_doc         VARCHAR(14),
  tomador_nome        VARCHAR(255),
  valor_servico       DECIMAL(12,2),
  competencia         VARCHAR(7),                      -- AAAA-MM
  erro_codigo         VARCHAR(20),
  erro_descricao      TEXT,
  cancelada_em        TIMESTAMPTZ,
  emitida_em          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Deduplicação de eventos Stripe
CREATE TABLE stripe_events (
  stripe_event_id  VARCHAR(255) PRIMARY KEY,
  tipo             VARCHAR(100),
  processado_em    TIMESTAMPTZ DEFAULT NOW()
);
```

### Índices críticos
```sql
CREATE UNIQUE INDEX ON api_keys(key_hash);
CREATE INDEX ON notas_fiscais(mei_id, competencia);
CREATE INDEX ON notas_fiscais(status) WHERE status = 'PROCESSANDO';
CREATE INDEX ON emissoes_mensais(mei_id, competencia);
CREATE UNIQUE INDEX ON meis(stripe_customer_id);
```

### Row Level Security (RLS)
```sql
-- Toda tabela tem RLS habilitado
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE emissoes_mensais ENABLE ROW LEVEL SECURITY;

-- Policy padrão: MEI só vê seus dados (via Supabase Auth JWT)
CREATE POLICY "mei_own_data" ON notas_fiscais
  FOR ALL USING (mei_id = auth.uid());

-- API Go usa service_role key (bypass RLS controlado)
```

---

## 5. API — CONTRATOS PRINCIPAIS

### Autenticação
```
Authorization: Bearer sk_live_<hex64>
```

### Endpoints

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | /v1/auth/register | ❌ | Cadastrar MEI + upload cert A1 |
| POST | /v1/auth/certificate | ✅ | Renovar certificado A1 |
| POST | /v1/nfse | ✅ | **Emitir nota fiscal** |
| GET | /v1/nfse | ✅ | Listar notas (paginado) |
| GET | /v1/nfse/:id | ✅ | Consultar status da nota |
| DELETE | /v1/nfse/:id | ✅ | Cancelar nota autorizada |
| GET | /v1/nfse/:id/pdf | ✅ | Download PDF |
| GET | /v1/nfse/:id/xml | ✅ | Download XML |
| GET | /v1/billing/usage | ✅ | Consumo do mês atual |
| GET | /v1/billing/portal | ✅ | URL do Customer Portal Stripe |
| POST | /v1/billing/checkout | ✅ | Criar Stripe Checkout Session |
| POST | /v1/webhooks/stripe | ❌ | Receber eventos Stripe (assinatura própria) |
| GET | /v1/health | ❌ | Health check (db, redis, rabbitmq, receita) |
| GET | /metrics | ❌ (IP whitelist) | Métricas Prometheus |

### Request de emissão (POST /v1/nfse)
```json
{
  "servico": {
    "codigo_nbs": "01.01.01.10",
    "discriminacao": "Desenvolvimento de software conforme contrato",
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
  "competencia": "2026-04",
  "webhook_url": "https://erp.empresa.com/webhooks/nfse"
}
```

### Response de emissão (202 Accepted)
```json
{
  "nota_id": "uuid",
  "status": "PROCESSANDO",
  "mensagem": "Nota enviada para processamento"
}
```

### Payload do webhook entregue
```json
{
  "event": "nfse.autorizada",
  "nota_id": "uuid",
  "status": "AUTORIZADA",
  "numero_nfse": "000123",
  "codigo_verificacao": "ABC12345",
  "pdf_url": "https://api.notameigateway.com.br/v1/nfse/uuid/pdf",
  "xml_url": "https://api.notameigateway.com.br/v1/nfse/uuid/xml",
  "emitida_em": "2026-04-26T14:30:00Z",
  "signature": "sha256=<hmac-hex>"
}
```

---

## 6. VARIÁVEIS DE AMBIENTE

### API Go (Railway)
```bash
# App
APP_ENV=production          # development | staging | production
PORT=8080
LOG_LEVEL=info

# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[pwd]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (Railway add-on — injetado automaticamente)
REDIS_URL=redis://...

# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqps://user:pass@broker.cloudamqp.com/vhost

# AWS
AWS_REGION=sa-east-1
AWS_KMS_KEY_ARN=arn:aws:kms:sa-east-1:...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...

# Receita Federal
RECEITA_API_URL=https://www.nfse.gov.br/m/app/api/recepcionar-lote-rps/v1
```

### Dashboard Next.js (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://api.notameigateway.com.br
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Local (desenvolvimento)
```bash
APP_ENV=development
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres  # Supabase local
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
RECEITA_API_URL=https://homologacao.nfse.gov.br/m/app/api/recepcionar-lote-rps/v1
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # gerado pelo stripe CLI
```

---

## 7. IDENTIDADE VISUAL

### Paleta de cores (design tokens)
```css
/* Brand */
--cyan-500: #00E8FF;   /* Principal: CTAs, links, destaques */
--navy-900: #0A0F1E;   /* Background geral */
--navy-700: #142035;   /* Cards */
--navy-600: #1E3050;   /* Bordas */

/* Texto */
--text-1: #EEF4FF;     /* Títulos */
--text-2: #8AA0B8;     /* Body */
--text-brand: #00E8FF; /* Destaque cyan */

/* Status de nota */
--success: #00C85A;    /* AUTORIZADA */
--warning: #F0B414;    /* PROCESSANDO */
--error:   #FF3232;    /* REJEITADA */
--neutral: #6473A0;    /* CANCELADA */
--upgrade: #7C6FFF;    /* upgrade de plano */
```

### Tipografia
```
Display / Títulos : Outfit 800 (peso extra-bold)
Corpo / Interface : Inter (regular, medium)
Código / Mono     : DM Mono
```

### Logos disponíveis em `apps/web/public/brand/`
```
logo-marca.svg              — símbolo isolado (hexágono + S)
logo-horizontal-dark.svg    — logo completo fundo escuro
logo-horizontal-light.svg   — logo completo fundo claro
logo-vertical.png           — logo vertical
favicon-32x32.png           — favicon
apple-touch-icon-180.png    — iOS icon
```

### Ícones de status (usar nos badges)
```
status-autorizada.png   → #00C85A (verde)
status-processando.png  → #F0B414 (amarelo, animar pulse)
status-rejeitada.png    → #FF3232 (vermelho)
status-cancelada.png    → #6473A0 (cinza)
```

---

## 8. ORDEM DE EXECUÇÃO (caminho crítico)

Siga **exatamente** esta ordem. Nunca iniciar uma task cujas dependências não estão completas.

```
Semana 1-2  →  PLAT-01 → PLAT-02 → INF-01 → INF-02 → INF-03 → INF-04
Semana 3    →  PLAT-03 → PLAT-04 → PLAT-07 → PLAT-08 → INF-06
Semana 4    →  STR-01 → AUTH-02 → AUTH-04 → AUTH-01 → AUTH-03
Semana 5    →  STR-02 → STR-03 → STR-04 → BIL-01 → BIL-02 → BIL-03
Semana 6-7  →  DOC-01 → DOC-02 → DOC-03 (⚠️ caminho mais crítico)
Semana 8-9  →  NFS-01 → NFS-02 → NFS-03 → NFS-04
Semana 10   →  API-01 → API-02 → API-03 → API-04 → API-05 → API-06
Semana 11   →  WBK-01 → WBK-02 → WBK-03 → DASH-01 → DASH-02 → DASH-03
Semana 12   →  QA-01 → QA-02 → QA-03 → QA-04 → QA-05
```

---

## 9. CONVENÇÕES DE CÓDIGO

### Go
```go
// Erros: sempre usar sentinel errors tipados
type ErrNotFound struct{ Resource string }
func (e ErrNotFound) Error() string { return fmt.Sprintf("%s not found", e.Resource) }

// Context: sempre propagar
func (s *Service) EmitirNota(ctx context.Context, req EmissaoRequest) (*Nota, error)

// Logging: sempre usar zerolog com campos estruturados
log.Ctx(ctx).Info().
    Str("mei_id", meiID).
    Str("nota_id", notaID).
    Msg("nota enviada para Receita")

// Nunca usar panic fora do startup
// Nunca usar init() para lógica de negócio
// Sempre fechar recursos com defer
```

### HTTP responses (Fiber)
```go
// Sucesso
return c.Status(fiber.StatusCreated).JSON(fiber.Map{
    "nota_id": nota.ID,
    "status":  nota.Status,
})

// Erro — sempre usar este formato
return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
    "error":      "VALIDATION_ERROR",
    "message":    "campos inválidos",
    "fields":     erros,     // []FieldError
    "request_id": c.Locals("request_id"),
})
```

### Códigos de erro padronizados
```
INVALID_API_KEY        → 401
PLAN_LIMIT_REACHED     → 402
FORBIDDEN              → 403
NOT_FOUND              → 404
ALREADY_CANCELLED      → 409
VALIDATION_ERROR       → 422
RECEITA_REJECTION      → 422
INTERNAL_ERROR         → 500
```

### Next.js
```typescript
// Sempre usar Server Components quando possível
// Client Components: apenas quando necessário (interatividade)
// Buscar dados no servidor — nunca expor service role key no cliente
// Usar Supabase createServerClient() em Server Components
// Usar Supabase createBrowserClient() em Client Components
```

---

## 10. COMANDOS ÚTEIS

```bash
# Desenvolvimento local
make dev                    # sobe API Go + Supabase local + Redis

# Banco
supabase start              # inicia Supabase local
supabase db reset           # aplica migrations + seed do zero
supabase db push            # aplica migrations em produção
supabase migration new nome # cria nova migration

# API Go
cd apps/api
go build ./...              # compila
go test ./...               # testa
go vet ./...                # analisa
golangci-lint run           # lint completo

# Stripe (desenvolvimento)
stripe listen --forward-to localhost:8080/v1/webhooks/stripe

# Railway
railway up                  # deploy manual
railway logs                # logs em tempo real
railway rollback            # reverter último deploy

# Vercel
vercel dev                  # ambiente local Next.js
vercel --prod               # deploy manual produção
```

---

## 11. SEGURANÇA — REGRAS INEGOCIÁVEIS

1. **Certificado A1 nunca em disco** — sempre em memória, via AWS Secrets Manager
2. **API Key real nunca no banco** — apenas SHA-256 do hash
3. **Service Role Key nunca no cliente** — apenas server-side
4. **Stripe Webhook** — sempre validar assinatura com `stripe.ConstructEvent`
5. **RLS habilitado em todas as tabelas** — sem exceção
6. **Variáveis de ambiente** — nunca hardcoded, nunca commitadas
7. **Logs** — nunca logar certificados, senhas ou chaves privadas
8. **MEI isolamento** — todo endpoint que retorna dados filtra por `mei_id` do contexto

---

## 12. LINKS ÚTEIS

| Recurso | URL |
|---|---|
| Repositório | https://github.com/christopheScantelbury/nota-mei-gateway |
| Supabase Dashboard | https://app.supabase.com |
| Railway Dashboard | https://railway.app/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Stripe Dashboard | https://dashboard.stripe.com |
| NFS-e Nacional Docs | https://www.nfse.gov.br/m/app/api |
| Schema ABRASF | https://www.nfse.gov.br/downloads/schemas |
| CloudAMQP | https://www.cloudamqp.com |
| Grafana Cloud | https://grafana.com/auth/sign-up |
