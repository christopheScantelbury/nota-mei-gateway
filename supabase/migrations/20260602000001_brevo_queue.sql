-- ─────────────────────────────────────────────────────────────────────────────
-- Brevo event queue + email dispatch log + lifecycle flags
-- Migration: 20260602000001_brevo_queue
-- Spec: 04-Modelos-Dados.md migrations 002, 003, 006.
--
-- Estratégia: queue de eventos a enviar para o Brevo com idempotência
-- (event_id UNIQUE) + retry exponencial. Worker via Vercel Cron consome
-- batch a cada 1 min.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tipos ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE brevo_event_status AS ENUM ('pending', 'sent', 'failed', 'dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Fila de eventos Brevo ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brevo_event_queue (
  id            BIGSERIAL PRIMARY KEY,
  event_id      TEXT NOT NULL UNIQUE,
  event_name    TEXT NOT NULL,
  email         TEXT NOT NULL,
  contact_id    INTEGER,
  properties    JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL,
  status        brevo_event_status NOT NULL DEFAULT 'pending',
  retry_count   SMALLINT NOT NULL DEFAULT 0,
  last_error    TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brevo_queue_pending
  ON brevo_event_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_brevo_queue_email_event
  ON brevo_event_queue(email, event_name);

COMMENT ON TABLE brevo_event_queue IS
  'Fila de eventos pra enviar ao Brevo. Idempotência via event_id UNIQUE; retry exp.';

ALTER TABLE brevo_event_queue ENABLE ROW LEVEL SECURITY;
-- Service role (worker) ignora RLS; nenhum policy pra anon/authenticated.

-- ── 3. Log de e-mails enviados ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_dispatch_log (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID,            -- nullable: pode logar antes do user existir
  email             TEXT NOT NULL,
  campaign_key      TEXT NOT NULL,   -- ex: 'onboarding_welcome', 'urgency_t60'
  template_id       INTEGER,
  brevo_message_id  TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at         TIMESTAMPTZ,
  clicked_at        TIMESTAMPTZ,
  bounced_at        TIMESTAMPTZ,
  unsubscribed_at   TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_dispatch_user      ON email_dispatch_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_campaign  ON email_dispatch_log(campaign_key);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_sent_at   ON email_dispatch_log(sent_at DESC);

-- Idempotência: 1 envio por (user_id, campaign_key). NULL-safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_dispatch_unique
  ON email_dispatch_log(user_id, campaign_key)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE email_dispatch_log IS
  'Log de e-mails Brevo. Idempotência por (user_id, campaign_key).';

ALTER TABLE email_dispatch_log ENABLE ROW LEVEL SECURITY;

-- ── 4. Lifecycle flags em empresas / meis ────────────────────────────────────
-- Permite checar rapidamente se evento "first_*" já ocorreu sem JOIN pesado.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS first_nfse_created_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_nfse_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cert_uploaded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_urgency     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_urgency_at  TIMESTAMPTZ;

ALTER TABLE meis
  ADD COLUMN IF NOT EXISTS first_nfse_created_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_nfse_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cert_uploaded_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_urgency     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_urgency_at  TIMESTAMPTZ;

COMMENT ON COLUMN empresas.first_nfse_authorized_at IS
  'Setado uma única vez no primeiro evento de autorização (idempotente via WHERE IS NULL).';
COMMENT ON COLUMN empresas.unsubscribed_urgency IS
  'Usuário descadastrou da série de urgência ME/EPP T-60→T-1.';

CREATE INDEX IF NOT EXISTS idx_empresas_unsub_urgency
  ON empresas(unsubscribed_urgency) WHERE unsubscribed_urgency = false;
