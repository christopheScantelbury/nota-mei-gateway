-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP6 · Billing placeholder ME
-- Migration: 20260615000001_billing_me
--
-- Resumo das mudanças:
--   1. planos.tipo_empresa: adiciona 'ALL' ao CHECK (planos que servem qualquer tipo)
--   2. empresas: adiciona trial_inicio + trial_fim
--   3. emissoes_mensais: remove unique constraint legada (mei_id, competencia)
--   4. Seed: Starter/Basic/Pro/Business ME + Trial EPP + Starter EPP (ativo=false)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. planos.tipo_empresa — ampliar CHECK para incluir 'ALL' ────────────────
--    Inline CHECK criado em 20260506000002 recebe nome automático planos_tipo_empresa_check.
--    DROP + ADD pois PostgreSQL não suporta ALTER CONSTRAINT em checks inline.

ALTER TABLE planos
    DROP CONSTRAINT IF EXISTS planos_tipo_empresa_check;

ALTER TABLE planos
    ADD CONSTRAINT planos_tipo_empresa_check
    CHECK (tipo_empresa IN ('MEI', 'ME', 'EPP', 'ALL'));

COMMENT ON COLUMN planos.tipo_empresa IS
    'Tipo societário alvo: MEI | ME | EPP | ALL (aplica a todos). NULL = legado MEI.';

-- ── 2. empresas — colunas trial_inicio / trial_fim ───────────────────────────

ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS trial_inicio TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS trial_fim    TIMESTAMPTZ;

-- Backfill: preencher trial_inicio com created_at para empresas já em trial
UPDATE empresas
SET trial_inicio = created_at
WHERE trial_me = true
  AND trial_inicio IS NULL;

COMMENT ON COLUMN empresas.trial_inicio IS
    'Data de início do trial ME/EPP. Preenchida automaticamente no cadastro.';
COMMENT ON COLUMN empresas.trial_fim IS
    'Data de encerramento do trial. NULL = trial ainda ativo. ' ||
    'Definida pelo admin via Supabase Dashboard ao ativar plano pago.';

-- ── 3. emissoes_mensais — remover unique constraint legada (mei_id, competencia)
--    A constraint (empresa_id, competencia) foi adicionada em ARCH-03 como
--    uq_emissoes_empresa_competencia. A legada é redundante e pode causar
--    conflitos em cadastros ME onde mei_id é NULL.

ALTER TABLE emissoes_mensais
    DROP CONSTRAINT IF EXISTS emissoes_mensais_mei_id_competencia_key;

-- Garantir plano_id nullable (explícito — já era por padrão no schema inicial)
ALTER TABLE emissoes_mensais
    ALTER COLUMN plano_id DROP NOT NULL;

-- ── 4. Seed — planos ME/EPP (ativo=false até time comercial definir preço) ───
--    Trial ME já foi inserido em 20260506000002 (ativo=true).
--    Demais planos criados aqui com ativo=false para não afetar o BillingGuard.

INSERT INTO planos (nome, tipo_empresa, emissoes_limite, preco_mensal_brl, preco_excedente_brl, ativo)
VALUES
  ('Starter ME',  'ME',  50,    NULL, NULL, false),
  ('Basic ME',    'ME',  150,   NULL, NULL, false),
  ('Pro ME',      'ME',  500,   NULL, NULL, false),
  ('Business ME', 'ME',  2000,  NULL, NULL, false),
  ('Trial EPP',   'EPP', 9999,  NULL, NULL, true),
  ('Starter EPP', 'EPP', 100,   NULL, NULL, false)
ON CONFLICT (nome) DO NOTHING;

-- Índice para buscas de trial ativo (relatório ME-52 usa trial_me=true frequentemente)
CREATE INDEX IF NOT EXISTS idx_empresas_trial_me
    ON empresas(trial_me)
    WHERE trial_me = true;
