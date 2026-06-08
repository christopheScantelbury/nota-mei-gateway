# 04 — Modelos de Dados

> Schemas PostgreSQL para todas as tabelas novas necessárias.
> Arquivos de migration em `db/migrations/`. Numeração sequencial — ajustar prefixo
> conforme o último número do projeto.

---

## Migration 001 — Feature Flags (HIST-7.4)

```sql
-- db/migrations/0XX_feature_flags.sql

CREATE TABLE feature_flags (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_pct SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  variants JSONB NOT NULL DEFAULT '[{"name":"treatment","weight":100}]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX idx_feature_flags_enabled ON feature_flags(enabled) WHERE enabled = true;

CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

-- Estrutura do JSONB variants:
-- [
--   {"name": "control", "weight": 50},
--   {"name": "treatment_a", "weight": 25},
--   {"name": "treatment_b", "weight": 25}
-- ]
-- Soma dos weights deve ser 100.

COMMENT ON TABLE feature_flags IS 'Feature flags para dark launch e A/B test sem ferramenta paga';
COMMENT ON COLUMN feature_flags.rollout_pct IS 'Percentual da base que vê alguma variante. Fora disso, todos veem control.';
COMMENT ON COLUMN feature_flags.variants IS 'Distribuição entre variantes dentro do rollout_pct.';
```

**Seeds iniciais sugeridos:**
```sql
INSERT INTO feature_flags (key, description, enabled, rollout_pct, variants) VALUES
('hero_copy_variant', 'Teste A/B da copy do hero (variante A = controle, B = urgência direta)', false, 0, '[{"name":"control","weight":50},{"name":"variant_b","weight":50}]'),
('sandbox_in_main_nav', 'Sandbox como item top-level no menu vs dentro do submenu Gateway', false, 0, '[{"name":"control","weight":50},{"name":"top_level","weight":50}]');
```

---

## Migration 002 — Brevo Event Queue (HIST-6.1)

```sql
-- db/migrations/0XX_brevo_event_queue.sql

CREATE TYPE brevo_event_status AS ENUM ('pending', 'sent', 'failed', 'dead');

CREATE TABLE brevo_event_queue (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_id INTEGER,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  status brevo_event_status NOT NULL DEFAULT 'pending',
  retry_count SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brevo_queue_status_retry
  ON brevo_event_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_brevo_queue_email_event
  ON brevo_event_queue(email, event_name);

COMMENT ON TABLE brevo_event_queue IS 'Fila de eventos a enviar para o Brevo, com retry e idempotência';
COMMENT ON COLUMN brevo_event_queue.event_id IS 'Chave única de idempotência. Padrão: {email}:{event_name}:{minute_timestamp}';
COMMENT ON COLUMN brevo_event_queue.status IS 'pending → sent (ok) | failed (retry) | dead (após 5 tentativas)';
```

**Política de purge (rodar mensalmente):**
```sql
DELETE FROM brevo_event_queue
WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '90 days';

DELETE FROM brevo_event_queue
WHERE status = 'dead' AND created_at < NOW() - INTERVAL '180 days';
```

---

## Migration 003 — Email Dispatch Log (auxiliar de 6.1 e 6.3)

```sql
-- db/migrations/0XX_email_dispatch_log.sql

CREATE TABLE email_dispatch_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  campaign_key TEXT NOT NULL,  -- ex: 'onboarding_welcome', 'urgency_t60'
  template_id INTEGER,
  brevo_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_email_dispatch_user ON email_dispatch_log(user_id);
CREATE INDEX idx_email_dispatch_campaign ON email_dispatch_log(campaign_key);
CREATE INDEX idx_email_dispatch_sent_at ON email_dispatch_log(sent_at DESC);

CREATE UNIQUE INDEX idx_email_dispatch_unique
  ON email_dispatch_log(user_id, campaign_key)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE email_dispatch_log IS 'Log de e-mails enviados via Brevo. Idempotência por (user_id, campaign_key) evita reenvio.';
```

---

## Migration 004 — Urgency Series Unsubscribe (HIST-6.3)

```sql
-- db/migrations/0XX_users_urgency_unsub.sql

ALTER TABLE users ADD COLUMN unsubscribed_urgency_series BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN unsubscribed_urgency_at TIMESTAMPTZ;

CREATE INDEX idx_users_urgency_unsub ON users(unsubscribed_urgency_series) WHERE unsubscribed_urgency_series = false;

COMMENT ON COLUMN users.unsubscribed_urgency_series IS 'Usuário descadastrou da série de urgência ME/EPP T-60→T-1';
```

**Endpoint público para o unsub (sem auth, com token):**

```sql
-- Token assinado HMAC para link de unsubscribe sem login
-- Gerar no envio do e-mail: HMAC_SHA256(user_id + 'urgency', SECRET)
-- Validar no clique
```

---

## Migration 005 — Pricing Plans (estrutura central)

```sql
-- db/migrations/0XX_pricing_plans.sql

CREATE TABLE pricing_plans (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,  -- 'mei_avulso', 'me_start', 'gateway_start', etc.
  persona TEXT NOT NULL CHECK (persona IN ('mei', 'me', 'dev')),
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_cents INTEGER,
  per_unit_price_cents INTEGER,
  notes_quota INTEGER,
  excedent_price_cents INTEGER,
  trial_days SMALLINT NOT NULL DEFAULT 0,
  is_anchor BOOLEAN NOT NULL DEFAULT false,  -- aparece na home
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order SMALLINT NOT NULL DEFAULT 0,
  bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge TEXT,
  highlight BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_persona_active ON pricing_plans(persona, is_active);
CREATE INDEX idx_pricing_anchor ON pricing_plans(is_anchor) WHERE is_anchor = true;

COMMENT ON TABLE pricing_plans IS 'Catálogo de planos. Anchor = plano de destaque na home (1 por persona).';
```

**Seeds iniciais — preços fechados:**
```sql
INSERT INTO pricing_plans (key, persona, name, description, monthly_price_cents, notes_quota, excedent_price_cents, trial_days, is_anchor, display_order, bullets, badge, highlight) VALUES
-- MEI
('mei_avulso', 'mei', 'Avulso', 'Emita quando precisar, sem compromisso mensal.', NULL, NULL, 290, 0, false, 1,
  '["Sem mensalidade","Pague só pelo que emitir","Ideal para MEI esporádico"]'::jsonb, NULL, false),

('mei_mensal', 'mei', 'MEI Mensal', 'Para MEI com clientes fixos todo mês.', 1900, 30, 90, 30, true, 2,
  '["Sem cartão no trial","PDF + XML automáticos","Suporte humano"]'::jsonb, NULL, false),

('mei_plus', 'mei', 'MEI Plus', 'Sem limite no dia a dia do MEI ativo.', 3900, 100, 80, 30, false, 3,
  '["100 notas/mês","Painel multi-cliente","Relatório mensal"]'::jsonb, 'Mais popular', false),

-- ME/EPP
('me_start', 'me', 'ME Start', 'Para Microempresa que precisa estar pronta para a NFS-e Nacional.', 7900, 50, 60, 30, true, 1,
  '["30 dias grátis · sem cartão","Simples Nacional e Lucro Presumido","Multi-empresa nativo"]'::jsonb, 'Obrigatório a partir de Set/2026', true),

('me_plus', 'me', 'ME Plus', 'Volume médio com previsibilidade.', 14900, 200, 55, 30, false, 2,
  '["200 notas/mês","API REST inclusa","Webhooks HMAC"]'::jsonb, NULL, false),

('me_pro', 'me', 'ME Pro', 'Para empresas com volume alto e múltiplos CNPJs.', 28900, 1000, 40, 30, false, 3,
  '["1.000 notas/mês","Multi-empresa avançado","Suporte prioritário"]'::jsonb, NULL, false),

-- Dev
('gateway_start', 'dev', 'Gateway Start', 'Para desenvolvedores que integram emissão ao seu produto.', 0, NULL, 89, 0, true, 1,
  '["API REST · JSON · Bearer","Webhooks HMAC-SHA256","SDKs Node/Python/PHP","Sandbox público sem cadastro"]'::jsonb, NULL, false),

('gateway_growth', 'dev', 'Gateway Growth', 'Volume previsível com franquia.', 9900, 200, 50, 30, false, 2,
  '["200 notas/mês inclusas","API REST completa","Multi-empresa"]'::jsonb, NULL, false),

('gateway_scale', 'dev', 'Gateway Scale', 'Volume alto, custo previsível.', 49900, 2000, 25, 30, false, 3,
  '["2.000 notas/mês inclusas","SLA 99.95%","Suporte dedicado"]'::jsonb, NULL, false);
```

---

## Migration 006 — Lifecycle Event Index (otimização para HIST-6.1)

```sql
-- db/migrations/0XX_lifecycle_first_event_check.sql

-- Para verificar rapidamente se um evento "first_*" já ocorreu para um usuário,
-- materializamos uma flag em users.

ALTER TABLE users ADD COLUMN first_nfse_created_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN first_nfse_authorized_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN cert_uploaded_at TIMESTAMPTZ;

CREATE INDEX idx_users_first_nfse_created ON users(first_nfse_created_at) WHERE first_nfse_created_at IS NOT NULL;

-- Update via aplicação no momento do evento:
-- UPDATE users SET first_nfse_created_at = NOW() WHERE id = $1 AND first_nfse_created_at IS NULL;
```

> **Importante:** o `WHERE first_nfse_created_at IS NULL` no UPDATE garante idempotência —
> só seta uma vez. O enfileiramento do evento Brevo deve checar isso antes de
> chamar `enqueueBrevoEvent`.

---

## Migration 007 — UTM Tracking Persistente (auxiliar para 7.2 e atribuição)

```sql
-- db/migrations/0XX_users_utm_first_touch.sql

ALTER TABLE users ADD COLUMN first_utm_source TEXT;
ALTER TABLE users ADD COLUMN first_utm_medium TEXT;
ALTER TABLE users ADD COLUMN first_utm_campaign TEXT;
ALTER TABLE users ADD COLUMN first_utm_content TEXT;
ALTER TABLE users ADD COLUMN first_utm_term TEXT;
ALTER TABLE users ADD COLUMN first_referrer TEXT;
ALTER TABLE users ADD COLUMN first_landing_page TEXT;

CREATE INDEX idx_users_first_utm_campaign ON users(first_utm_campaign) WHERE first_utm_campaign IS NOT NULL;
```

**Captura no client:** cookie `nf_first_touch` (validade 30 dias, JSON com os 7 campos),
preenchido na primeira visita. No signup, copiar do cookie para o registro do usuário.

---

## Resumo das migrations a executar

| # | Nome | Sprint | Dependência |
|---|---|---|---|
| 001 | `feature_flags` | Sprint 3 (HIST-7.4) | — |
| 002 | `brevo_event_queue` | Sprint 2 (HIST-6.1) | — |
| 003 | `email_dispatch_log` | Sprint 2 (HIST-6.1) | — |
| 004 | `users_urgency_unsub` | Sprint 3 (HIST-6.3) | tabela `users` |
| 005 | `pricing_plans` | Sprint 2 (HIST-2.1) | — |
| 006 | `lifecycle_first_event_check` | Sprint 2 (HIST-6.1) | tabela `users` |
| 007 | `users_utm_first_touch` | Sprint 1 (HIST-7.2) | tabela `users` |

## Convenções gerais de migration

- Sempre `BIGSERIAL` em PKs novas (futuro-prova)
- `TIMESTAMPTZ` em datas (nunca `TIMESTAMP` sem TZ)
- `NOT NULL DEFAULT` em colunas booleanas
- `COMMENT ON` em tabelas e colunas não-óbvias
- Migrations reversíveis quando viável (criar arquivo `*.down.sql` correspondente)
- Nunca `DROP COLUMN` em migration de produção sem fase de deprecation
