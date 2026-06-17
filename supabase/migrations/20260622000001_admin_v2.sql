-- ============================================================
-- Migration: admin_v2
-- Permissões per-tela granulares pra área /admin.
-- Implementa issue #230.
--
-- Hoje:  middleware.ts checa app_metadata.role === 'admin' (tudo-ou-nada)
-- Agora: tabela admin_users + admin_page_grants (can_read/can_write por path)
--        super_admin tem acesso total sem grants.
--
-- + admin_audit_log pra rastrear ações destrutivas (plano edit, user promote,
--   landing publish, page access).
-- ============================================================

-- ─── 1. admin_users — quem é admin + role ─────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    user_id     UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role        VARCHAR(20)  NOT NULL DEFAULT 'admin'
                CHECK (role IN ('admin', 'super_admin')),
    ativo       BOOLEAN      NOT NULL DEFAULT true,
    notes       TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by  UUID         REFERENCES auth.users(id),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_ativo ON admin_users(ativo) WHERE ativo = true;


-- ─── 2. admin_page_grants — granularidade por rota ────────────────────────
-- Cada admin pode ter read/write separados por path. Super_admin ignora
-- esta tabela (acesso total).
CREATE TABLE IF NOT EXISTS admin_page_grants (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES admin_users(user_id) ON DELETE CASCADE,
    page_path   VARCHAR(200) NOT NULL,
    can_read    BOOLEAN      NOT NULL DEFAULT true,
    can_write   BOOLEAN      NOT NULL DEFAULT false,
    granted_by  UUID         REFERENCES auth.users(id),
    granted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, page_path)
);

CREATE INDEX IF NOT EXISTS idx_admin_grants_user ON admin_page_grants(user_id);


-- ─── 3. admin_audit_log — trilha de ações destrutivas/sensíveis ───────────
-- Toda ação write em /admin/* gera entrada aqui. Permite investigar quem
-- mudou o quê (compliance + rastreabilidade).
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES auth.users(id),
    action      VARCHAR(80)  NOT NULL,
    -- examples: page_access, plan_edit, plan_create, plan_archive,
    --           user_promote, user_demote, user_grant_change,
    --           landing_section_edit, landing_publish, landing_rollback
    target_kind VARCHAR(40),    -- 'plano' | 'user' | 'page' | 'landing_section' | ...
    target_id   VARCHAR(100),   -- ID do recurso afetado (uuid, path, etc)
    before_data JSONB,          -- snapshot antes
    after_data  JSONB,          -- snapshot depois
    ip          VARCHAR(45),    -- IPv4 ou IPv6
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_created ON admin_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target      ON admin_audit_log(target_kind, target_id);


-- ─── 4. Helper: is_super_admin(uid) ───────────────────────────────────────
-- Usado pelas RLS abaixo + pelo middleware Next.js via RPC.
CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = uid AND role = 'super_admin' AND ativo = true
    );
$$;

CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = uid AND ativo = true
    );
$$;


-- ─── 5. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_page_grants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log    ENABLE ROW LEVEL SECURITY;

-- admin_users: admin lê próprio registro; super_admin lê todos.
CREATE POLICY "admin_users_read_self" ON admin_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_users_super_full" ON admin_users
    FOR ALL USING (is_super_admin(auth.uid()));

-- admin_page_grants: admin lê próprios grants; super_admin lê todos.
CREATE POLICY "grants_read_self" ON admin_page_grants
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "grants_super_full" ON admin_page_grants
    FOR ALL USING (is_super_admin(auth.uid()));

-- admin_audit_log: admin lê próprio histórico; super_admin lê tudo.
-- Writes vêm via service role (server actions) — não permitir client.
CREATE POLICY "audit_read_self" ON admin_audit_log
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "audit_super_read" ON admin_audit_log
    FOR SELECT USING (is_super_admin(auth.uid()));


-- ─── 6. Seed: Christophe como super_admin inicial ─────────────────────────
-- 5a7353a4-add4-48a0-9843-718eb4f72680 é o user_id do christophescantelbury@gmail.com
INSERT INTO admin_users (user_id, role, notes, created_at)
VALUES (
    '5a7353a4-add4-48a0-9843-718eb4f72680',
    'super_admin',
    'Seed inicial — owner do projeto (commit 20260622000001_admin_v2)',
    NOW()
)
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', ativo = true;


-- ─── 7. Comentários (documentação inline pra pg dump) ─────────────────────
COMMENT ON TABLE admin_users IS
    'Lista de usuários com acesso à área /admin. role=super_admin tem acesso total.';
COMMENT ON TABLE admin_page_grants IS
    'Permissões granulares por path /admin/*. Super_admin ignora esta tabela.';
COMMENT ON TABLE admin_audit_log IS
    'Trilha de ações destrutivas/sensíveis em /admin. Append-only via service role.';
COMMENT ON FUNCTION is_super_admin(UUID) IS
    'Helper SQL pra RLS verificar se um user é super_admin ativo.';
COMMENT ON FUNCTION is_admin(UUID) IS
    'Helper SQL pra RLS verificar se um user é admin (qualquer role) ativo.';
