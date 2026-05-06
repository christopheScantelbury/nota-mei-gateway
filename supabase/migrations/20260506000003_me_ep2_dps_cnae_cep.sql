-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP2 — DPS Builder: adicionar cnae e cep na tabela empresas
-- Migration: 20260506000003_me_ep2_dps_cnae_cep
-- ─────────────────────────────────────────────────────────────────────────────
--
-- A DPS (Declaração de Prestação de Serviços) exige dois campos que não existiam
-- no modelo anterior:
--
--   cnae  — Código Nacional de Atividades Econômicas (7 dígitos).
--           Incluído no bloco <regTrib> da DPS. Obrigatório para ME/EPP.
--
--   cep   — CEP do endereço do prestador (8 dígitos, sem hífen).
--           Incluído no bloco <enderNac> da DPS. Obrigatório para ME/EPP.
--
-- Ambos são NULLABLE para manter compatibilidade retroativa com registros MEI
-- existentes. O builder valida em runtime se estão preenchidos antes de emitir.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── cnae: código de atividade econômica ───────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cnae VARCHAR(7);

-- ── cep: CEP do endereço do prestador ─────────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cep VARCHAR(8);

COMMENT ON COLUMN empresas.cnae IS 'CNAE principal da empresa (7 dígitos, sem hífen). Obrigatório para DPS (ME/EPP).';
COMMENT ON COLUMN empresas.cep  IS 'CEP do endereço do prestador (8 dígitos, sem hífen). Obrigatório para DPS (ME/EPP).';

-- ── Índice para consultas de validação futura ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_empresas_cnae ON empresas(cnae) WHERE cnae IS NOT NULL;
