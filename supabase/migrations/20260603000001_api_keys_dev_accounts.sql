-- ─────────────────────────────────────────────────────────────────────────────
-- Permite api_keys vinculadas a um auth.user (dev integrador) sem empresa.
-- Migration: 20260603000001_api_keys_dev_accounts
--
-- Contexto: hoje todo cadastro de API key exige uma `empresa_id`. Mas o dev
-- integrador (modelo Gateway/SaaS) pode estar testando a API sem ter empresa
-- emissora cadastrada — ele cadastra empresas DEPOIS, quando for emitir notas
-- reais. Aqui flexibilizamos pra api_key ser vinculada ao user_id sozinho.
--
-- Constraint garante que pelo menos um dos dois (user_id ou empresa_id) esteja
-- presente. API key SEM empresa = só sandbox (sk_test_). API key COM empresa
-- = produção (sk_live_).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Adiciona user_id (FK pra auth.users) — opcional
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Torna empresa_id opcional
ALTER TABLE api_keys
  ALTER COLUMN empresa_id DROP NOT NULL;

-- 3. Pelo menos um dos dois precisa estar setado
DO $$ BEGIN
  ALTER TABLE api_keys
    ADD CONSTRAINT api_keys_owner_required
    CHECK (user_id IS NOT NULL OR empresa_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Índice pra lookups por user_id
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)
  WHERE user_id IS NOT NULL;

-- 5. RLS — user vê SUAS api_keys (dev) + as da empresa dele
DROP POLICY IF EXISTS "api_keys_select_own_dev" ON api_keys;
CREATE POLICY "api_keys_select_own_dev" ON api_keys
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys_insert_own_dev" ON api_keys;
CREATE POLICY "api_keys_insert_own_dev" ON api_keys
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "api_keys_update_own_dev" ON api_keys;
CREATE POLICY "api_keys_update_own_dev" ON api_keys
  FOR UPDATE
  USING (user_id = auth.uid());

COMMENT ON COLUMN api_keys.user_id IS
  'Dono direto da chave (dev integrador sem empresa). Mutuamente exclusivo com empresa_id pra api keys de dev. Quando dev cadastra empresa, novas keys passam a ter empresa_id.';

COMMENT ON CONSTRAINT api_keys_owner_required ON api_keys IS
  'Pelo menos user_id (dev) ou empresa_id (cadastro com CNPJ) deve estar setado';
