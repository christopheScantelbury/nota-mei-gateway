-- ============================================================
-- Migration: customer_feedback + customer_nps
-- Canal interno pro cliente reportar bug/sugestão/dúvida/elogio +
-- NPS automático após 5ª nota. Implementa issue #246.
-- ============================================================

-- ─── 1. customer_feedback — reports do dashboard ─────────────────────────
CREATE TABLE IF NOT EXISTS customer_feedback (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    empresa_id      UUID         REFERENCES empresas(id) ON DELETE SET NULL,
    tipo            VARCHAR(20)  NOT NULL
                    CHECK (tipo IN ('bug', 'sugestao', 'duvida', 'elogio')),
    mensagem        TEXT         NOT NULL CHECK (length(mensagem) BETWEEN 5 AND 2000),
    url             TEXT,          -- página onde o user estava
    user_agent      TEXT,
    screenshot_url  TEXT,          -- presigned URL no Supabase Storage
    status          VARCHAR(20)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'triaging', 'resolved', 'wontfix')),
    resolved_by     UUID         REFERENCES auth.users(id),
    resolved_at     TIMESTAMPTZ,
    notes_admin     TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON customer_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tipo           ON customer_feedback(tipo);
CREATE INDEX IF NOT EXISTS idx_feedback_user           ON customer_feedback(user_id, created_at DESC);


-- ─── 2. customer_nps — pesquisas de satisfação ───────────────────────────
CREATE TABLE IF NOT EXISTS customer_nps (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id  UUID         REFERENCES empresas(id) ON DELETE CASCADE,
    score       INTEGER      NOT NULL CHECK (score BETWEEN 0 AND 10),
    comentario  TEXT         CHECK (length(comentario) <= 1000),
    trigger     VARCHAR(50), -- '5th_note' | 'manual' | 'monthly'
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nps_score        ON customer_nps(score);
CREATE INDEX IF NOT EXISTS idx_nps_user_created ON customer_nps(user_id, created_at DESC);


-- ─── 3. RLS ──────────────────────────────────────────────────────────────
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_nps      ENABLE ROW LEVEL SECURITY;

-- User lê próprios feedbacks e pode INSERT/UPDATE só se for autor.
CREATE POLICY "feedback_own_read"   ON customer_feedback FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "feedback_own_insert" ON customer_feedback FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "nps_own_read"        ON customer_nps      FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "nps_own_insert"      ON customer_nps      FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin (is_admin) lê tudo + faz UPDATE pra resolver feedbacks.
CREATE POLICY "feedback_admin_read"   ON customer_feedback FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "feedback_admin_update" ON customer_feedback FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "nps_admin_read"        ON customer_nps      FOR SELECT USING (is_admin(auth.uid()));


-- ─── 4. Comentários ───────────────────────────────────────────────────────
COMMENT ON TABLE customer_feedback IS
    'Feedback do cliente via botão fixo do dashboard. status=open|triaging|resolved|wontfix.';
COMMENT ON TABLE customer_nps IS
    'Pesquisas NPS. Trigger 5th_note dispara após emissão da 5ª nota autorizada do mês.';
COMMENT ON COLUMN customer_feedback.screenshot_url IS
    'URL pública do screenshot no bucket feedback-screenshots (Supabase Storage).';
