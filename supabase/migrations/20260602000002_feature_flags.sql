-- ─────────────────────────────────────────────────────────────────────────────
-- Feature flags caseiras (A/B test sem dependência externa).
-- Migration: 20260602000002_feature_flags
-- Spec: HIST-7.4 + D-05 + 04-Modelos-Dados.md migration 001.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id           BIGSERIAL PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  description  TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT false,
  rollout_pct  SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  variants     JSONB NOT NULL DEFAULT '[{"name":"treatment","weight":100}]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   TEXT,
  updated_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled
  ON feature_flags(enabled) WHERE enabled = true;

CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER trigger_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_flags_updated_at();

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
-- Leitura pública (sem dados sensíveis):
CREATE POLICY "feature_flags_public_read" ON feature_flags FOR SELECT USING (true);

COMMENT ON TABLE feature_flags IS 'Feature flags caseiras (D-05) para A/B e dark launch sem dep externa';
COMMENT ON COLUMN feature_flags.rollout_pct IS 'Percentual da base que vê variante. Fora disso = control.';
COMMENT ON COLUMN feature_flags.variants IS '[{name,weight}] — soma dos weights deve ser 100';

-- Seeds iniciais
INSERT INTO feature_flags (key, description, enabled, rollout_pct, variants) VALUES
  ('hero_copy_variant', 'Teste A/B copy do hero (A=controle propositiva, B=urgência direta)', false, 0,
    '[{"name":"control","weight":50},{"name":"variant_b","weight":50}]'::jsonb),
  ('sandbox_in_main_nav', 'Sandbox como item top-level no menu vs submenu Gateway', false, 0,
    '[{"name":"control","weight":50},{"name":"top_level","weight":50}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
