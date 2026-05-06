-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP5 (ME-42) — regime tributário and ISS retention flag on notas_fiscais
-- Migration: 20260506000006_me_ep5_nota_regime
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds two columns so the dashboard can show the ISS recolhimento badge
-- without joining back to empresas/meis at query time (ME-42).
--
-- Both columns are nullable for backward compatibility with existing rows.
-- The API layer writes them when creating a new nota (backend update in ME-EP5).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(30),
  ADD COLUMN IF NOT EXISTS iss_retido        BOOLEAN;

COMMENT ON COLUMN notas_fiscais.regime_tributario
  IS 'Tax regime of the emitting company at time of emission (SIMPLES_MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL). NULL for historical rows.';

COMMENT ON COLUMN notas_fiscais.iss_retido
  IS 'True when ISS was withheld at source by the tomador (applicable to LUCRO_PRESUMIDO/LUCRO_REAL). NULL for MEI/SN rows.';
