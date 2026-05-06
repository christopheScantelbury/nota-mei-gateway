-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP2 (ME-32) — nota substitution linkage
-- Migration: 20260506000005_me_ep2_substituida_por
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds `substituida_por` so that when a ME/EPP nota is substituted the
-- cancelled original row keeps a reference to the new nota issued in its place.
-- Nullable; NULL means the nota was not substituted.
--
-- The 9-day substitution window is enforced in the API layer (handler/nfse.go).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS substituida_por UUID REFERENCES notas_fiscais(id);

COMMENT ON COLUMN notas_fiscais.substituida_por
  IS 'UUID of the replacement nota. Set when this nota is cancelled via substituição (ME-32, 9-day window).';

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_substituida_por
  ON notas_fiscais(substituida_por)
  WHERE substituida_por IS NOT NULL;
