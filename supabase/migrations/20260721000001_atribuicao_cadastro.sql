-- Atribuição de origem do cadastro (gclid / utm_*).
--
-- Motivo: o GA4 só reporta quem aceita o banner de cookies (Consent Mode v2
-- default 'denied' + volume baixo demais pra modelagem comportamental). Em
-- 2026-07-21 medimos 77 cliques no Google Ads virando 8 sessões visíveis no
-- GA4 (~10%), o que tornava impossível responder "a campanha gerou cadastro?".
-- Gravando a origem aqui, o banco vira a fonte da verdade — imune a consent,
-- adblock e modelagem.
--
-- Todas as colunas são NULL-able: cadastro orgânico simplesmente não preenche.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS gclid         TEXT,
  ADD COLUMN IF NOT EXISTS utm_source    TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium    TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign  TEXT,
  ADD COLUMN IF NOT EXISTS utm_term      TEXT,
  ADD COLUMN IF NOT EXISTS utm_content   TEXT,
  ADD COLUMN IF NOT EXISTS landing_page  TEXT,
  ADD COLUMN IF NOT EXISTS referrer      TEXT;

COMMENT ON COLUMN empresas.gclid IS
  'Google Click ID do anúncio que originou o cadastro (ou gbraid/wbraid em contexto sem cookie cross-site). NULL = cadastro não veio de clique pago.';
COMMENT ON COLUMN empresas.utm_source IS
  'Origem da campanha (ex: google). Modelo last non-direct touch — ver apps/web/lib/analytics/attribution.ts.';

-- Índice parcial: só interessam as linhas COM atribuição, que são a minoria.
-- Serve o relatório "quantos cadastros por origem no período".
CREATE INDEX IF NOT EXISTS idx_empresas_atribuicao
  ON empresas (utm_source, utm_medium, created_at)
  WHERE utm_source IS NOT NULL;

-- Cadastros vindos de clique pago, sem depender de utm (o Ads às vezes manda
-- só o gclid quando o auto-tagging está ligado e não há utm manual).
CREATE INDEX IF NOT EXISTS idx_empresas_gclid
  ON empresas (created_at)
  WHERE gclid IS NOT NULL;
