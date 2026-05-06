-- ─────────────────────────────────────────────────────────────────────────────
-- ME-EP1 — Campos adicionais em empresas + plano Trial ME
-- Migration: 20260506000002_me_ep1_empresas_extras
-- ─────────────────────────────────────────────────────────────────────────────

-- ── empresas: campos novos para ME ───────────────────────────────────────────

-- inscricao_municipal: opcional, ME pode não ter no momento do cadastro.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(20);

-- trial_me: bypass do BillingGuard enquanto plano pago ME não é definido (ME-51).
-- Ativado automaticamente no cadastro; admin desativa via dashboard Supabase.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS trial_me BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN empresas.inscricao_municipal IS 'Inscrição municipal do prestador. Opcional — incluída na DPS quando preenchida.';
COMMENT ON COLUMN empresas.trial_me            IS 'true = trial ilimitado ativo (BillingGuard bypassado). Desativar via Supabase Dashboard quando plano pago ME for definido.';

-- ── planos: discriminador tipo_empresa ───────────────────────────────────────
-- NULL = plano MEI (comportamento original preservado).
-- 'ME' / 'EPP' = planos específicos por tipo societário.

ALTER TABLE planos
  ADD COLUMN IF NOT EXISTS tipo_empresa VARCHAR(10)
    CHECK (tipo_empresa IN ('MEI','ME','EPP'));

COMMENT ON COLUMN planos.tipo_empresa IS 'Tipo societário alvo do plano. NULL = MEI (legado). ME/EPP = planos para empresas maiores.';

-- ── Seed: plano Trial ME (ilimitado enquanto preço não definido) ──────────────
INSERT INTO planos (nome, emissoes_limite, preco_mensal_brl, preco_excedente_brl, tipo_empresa, ativo)
VALUES ('Trial ME', 9999, NULL, NULL, 'ME', true)
ON CONFLICT DO NOTHING;
