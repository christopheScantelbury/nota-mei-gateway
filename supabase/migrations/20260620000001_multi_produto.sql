-- ============================================================
-- Migration: multi_produto
-- Permite um usuário (auth.uid) ter múltiplas empresas,
-- com preferência salva e auditoria cross-produto.
-- ============================================================

-- ─── 1. user_id na tabela empresas ──────────────────────────
-- Permite um usuário ter múltiplas empresas

ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Popular user_id nos registros existentes
-- (hoje id = auth.uid() via RLS, então user_id = id)
UPDATE empresas SET user_id = id WHERE user_id IS NULL;

ALTER TABLE empresas ALTER COLUMN user_id SET NOT NULL;

-- Remover política RLS antiga
DROP POLICY IF EXISTS "empresa_own_data" ON empresas;

-- Nova política: filtra por user_id (não mais por id)
CREATE POLICY "empresa_own_data" ON empresas
    FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_empresas_user_id ON empresas(user_id);


-- ─── 2. Preferências do usuário ─────────────────────────────
-- Persiste a última empresa acessada para pular o seletor

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID        REFERENCES empresas(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_prefs" ON user_preferences
    FOR ALL USING (user_id = auth.uid());


-- ─── 3. Histórico de migrações de tipo ──────────────────────

CREATE TABLE IF NOT EXISTS empresa_migracoes (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID        NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    de_tipo     VARCHAR(10) NOT NULL,
    para_tipo   VARCHAR(10) NOT NULL,
    de_regime   VARCHAR(30),
    para_regime VARCHAR(30),
    status      VARCHAR(20) DEFAULT 'CONCLUIDA'
                CHECK (status IN ('PENDENTE', 'CONCLUIDA', 'REVERTIDA')),
    migrado_em  TIMESTAMPTZ DEFAULT NOW(),
    notas       TEXT
);

ALTER TABLE empresa_migracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migracoes_own" ON empresa_migracoes
    FOR SELECT USING (
        empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid())
    );

CREATE INDEX ON empresa_migracoes(empresa_id);


-- ─── 4. Audit log unificado cross-produto ───────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    empresa_id UUID        REFERENCES empresas(id)   ON DELETE SET NULL,
    produto    VARCHAR(20) NOT NULL
               CHECK (produto IN ('MEI_DASHBOARD', 'ME_DASHBOARD', 'API_GATEWAY', 'ADMIN')),
    acao       VARCHAR(100) NOT NULL,
    metadata   JSONB,
    ip_origem  INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_own" ON audit_log
    FOR SELECT USING (user_id = auth.uid());

CREATE INDEX ON audit_log(empresa_id, created_at DESC);
CREATE INDEX ON audit_log(user_id,    created_at DESC);
CREATE INDEX ON audit_log(produto,    created_at DESC);
CREATE INDEX ON audit_log(created_at DESC);


-- ─── 5. Atualizar RLS das tabelas dependentes ────────────────
-- As políticas antigas usavam empresa_id = auth.uid() (funciona para empresas
-- onde id == auth.uid(), i.e. um único MEI por usuário). As novas usam uma
-- subquery em empresas.user_id para suportar múltiplas empresas por usuário.

-- api_keys
DROP POLICY IF EXISTS "mei_own_data_api_keys" ON api_keys;
DROP POLICY IF EXISTS "empresa_own_api_keys"  ON api_keys;
CREATE POLICY "empresa_own_api_keys" ON api_keys
    FOR ALL USING (
        empresa_id IN (
            SELECT id FROM empresas WHERE user_id = auth.uid()
        )
    );

-- notas_fiscais
DROP POLICY IF EXISTS "mei_own_data_notas" ON notas_fiscais;
DROP POLICY IF EXISTS "empresa_own_notas"  ON notas_fiscais;
CREATE POLICY "empresa_own_notas" ON notas_fiscais
    FOR ALL USING (
        empresa_id IN (
            SELECT id FROM empresas WHERE user_id = auth.uid()
        )
    );

-- emissoes_mensais
DROP POLICY IF EXISTS "mei_own_data_emissoes" ON emissoes_mensais;
DROP POLICY IF EXISTS "empresa_own_emissoes"  ON emissoes_mensais;
CREATE POLICY "empresa_own_emissoes" ON emissoes_mensais
    FOR ALL USING (
        empresa_id IN (
            SELECT id FROM empresas WHERE user_id = auth.uid()
        )
    );
