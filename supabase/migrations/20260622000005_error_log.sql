-- ============================================================
-- Migration: error_log
-- Observabilidade in-house — captura errors do frontend (e backend
-- futuro). Implementa parte do issue #245 (Sentry SDK fica pra próxima
-- fase). Substitui Sentry como MVP sem dep externa.
-- ============================================================

CREATE TABLE IF NOT EXISTS error_log (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint     VARCHAR(64)  NOT NULL,
    -- hash do error message + topo do stack pra deduplicar
    level           VARCHAR(20)  NOT NULL DEFAULT 'error'
                    CHECK (level IN ('error', 'warning', 'info')),
    source          VARCHAR(40)  NOT NULL,
    -- 'web-client' | 'web-server' | 'api-go' | 'worker-go'
    message         TEXT         NOT NULL,
    stack           TEXT,
    url             TEXT,
    user_id         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    user_agent      TEXT,
    metadata        JSONB,
    occurrence_count INTEGER     NOT NULL DEFAULT 1,
    -- updated quando o mesmo fingerprint volta a aparecer
    first_seen_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved        BOOLEAN      NOT NULL DEFAULT false,
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID         REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_error_log_fingerprint ON error_log(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_log_last_seen    ON error_log(last_seen_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_error_log_source_level ON error_log(source, level);


-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE error_log ENABLE ROW LEVEL SECURITY;

-- Só admin vê (via grant /admin/errors ou super_admin).
-- Writes vêm via service role (API /api/errors).
CREATE POLICY "error_log_admin_read" ON error_log
    FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "error_log_admin_update" ON error_log
    FOR UPDATE USING (is_admin(auth.uid()));


-- ─── Helper SQL pra upsert idempotente ────────────────────────────────────
-- Quando um error com mesmo fingerprint chega, incrementa counter +
-- update last_seen ao invés de duplicar row.
CREATE OR REPLACE FUNCTION error_log_upsert(
    p_fingerprint VARCHAR(64),
    p_level       VARCHAR(20),
    p_source      VARCHAR(40),
    p_message     TEXT,
    p_stack       TEXT,
    p_url         TEXT,
    p_user_id     UUID,
    p_user_agent  TEXT,
    p_metadata    JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO error_log (
        fingerprint, level, source, message, stack, url, user_id,
        user_agent, metadata
    ) VALUES (
        p_fingerprint, p_level, p_source, p_message, p_stack, p_url,
        p_user_id, p_user_agent, p_metadata
    )
    ON CONFLICT (fingerprint) DO UPDATE SET
        occurrence_count = error_log.occurrence_count + 1,
        last_seen_at     = NOW(),
        message          = EXCLUDED.message,
        stack            = COALESCE(EXCLUDED.stack, error_log.stack),
        url              = COALESCE(EXCLUDED.url, error_log.url),
        user_id          = COALESCE(EXCLUDED.user_id, error_log.user_id),
        metadata         = COALESCE(EXCLUDED.metadata, error_log.metadata)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


COMMENT ON TABLE error_log IS
    'Captura errors do frontend (client+server) + backend Go. Dedupe via fingerprint hash.';
COMMENT ON COLUMN error_log.fingerprint IS
    'SHA-256 (truncado) de message + stack[0] — agrupa ocorrências idênticas.';
