-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP2 — DPS sequences table for ME/EPP NFS-e Nacional serial numbers
-- Migration: 20260506000004_me_ep2_dps_sequences
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ME/EPP companies cannot use rps_sequences because its mei_id column is a
-- PRIMARY KEY referencing meis(id) — ME/EPP companies don't exist in meis.
-- This table provides the same atomic INSERT ON CONFLICT DO UPDATE guarantee
-- keyed on empresa_id, enabling horizontal scaling without serial collisions.
--
-- Note: cnae + cep columns were added to empresas in migration 20260506000003.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dps_sequences (
  empresa_id UUID    PRIMARY KEY REFERENCES empresas(id) ON DELETE CASCADE,
  ultimo_dps BIGINT  NOT NULL DEFAULT 0
);

ALTER TABLE dps_sequences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  dps_sequences            IS 'Atomic per-empresa DPS serial counter for ME/EPP NFS-e Nacional.';
COMMENT ON COLUMN dps_sequences.ultimo_dps IS 'Last allocated DPS number. Starts at 0; first issued number is 1.';
