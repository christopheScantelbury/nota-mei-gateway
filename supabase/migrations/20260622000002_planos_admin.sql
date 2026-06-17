-- ============================================================
-- Migration: planos_admin
-- Suporta CRUD admin de planos com sync Stripe + audit history.
-- Implementa issue #235.
-- ============================================================

-- ─── 1. Novas colunas em planos ───────────────────────────────────────────
ALTER TABLE planos
    ADD COLUMN IF NOT EXISTS descricao_curta   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS destaque          BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ordem_exibicao    INTEGER     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stripe_sync_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_sync_error TEXT,
    ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_planos_ordem ON planos(ordem_exibicao);


-- ─── 2. Audit trail das mudanças ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planos_history (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id      UUID         NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
    user_id       UUID         REFERENCES auth.users(id),
    campo         VARCHAR(50)  NOT NULL,
    -- ex: nome | preco_mensal_brl | emissoes_limite | descricao_curta | ativo
    valor_antigo  TEXT,
    valor_novo    TEXT,
    stripe_action VARCHAR(50),
    -- price_created | price_archived | product_updated | subscription_migrated | none
    stripe_ref    VARCHAR(100),  -- ID Stripe afetado (price/product/sub)
    notes         TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_history_plano    ON planos_history(plano_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planos_history_user     ON planos_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planos_history_action   ON planos_history(stripe_action) WHERE stripe_action IS NOT NULL;


-- ─── 3. RLS ───────────────────────────────────────────────────────────────
-- planos.ativo é leitura pública (landing precisa listar planos).
-- planos_history só admin com grant pra /admin/planos.
ALTER TABLE planos_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planos_history_super_read" ON planos_history
    FOR SELECT USING (is_super_admin(auth.uid()));

-- Writes em planos_history vêm via service role.


-- ─── 4. Backfill stripe_product_id pros 9 planos existentes ───────────────
-- (Os mesmos hardcoded no scripts/db-sync-planos.mjs)
UPDATE planos SET stripe_product_id = 'prod_UTAuGnSjKooV6n' WHERE nome = 'Trial MEI';
UPDATE planos SET stripe_product_id = 'prod_UeJSM77dfSTAMh' WHERE nome = 'Avulso MEI';
UPDATE planos SET stripe_product_id = 'prod_UTAuH8TnTrImYZ' WHERE nome = 'MEI Mensal';
UPDATE planos SET stripe_product_id = 'prod_UeJSsdo3wmCL0w' WHERE nome = 'MEI Plus';
UPDATE planos SET stripe_product_id = 'prod_UeJSXqYbRpSGnA' WHERE nome = 'MEI Premium';
UPDATE planos SET stripe_product_id = 'prod_UeJS80A40Z0kna' WHERE nome = 'Trial ME';
UPDATE planos SET stripe_product_id = 'prod_UTAu7miepp5T7v' WHERE nome = 'ME Start';
UPDATE planos SET stripe_product_id = 'prod_UTAu0JaTLfKeYr' WHERE nome = 'ME Pro';
UPDATE planos SET stripe_product_id = 'prod_UTAurjiADu5bWv' WHERE nome = 'ME Business';

-- Descrições curtas (replicadas do que ficou no Stripe via stripe-fix-descriptions.mjs)
UPDATE planos SET descricao_curta = 'Emissão de até 5 NFS-e por mês — sem cartão' WHERE nome IN ('Trial MEI', 'Trial ME', 'Trial EPP');
UPDATE planos SET descricao_curta = 'Pague por nota emitida — R$ 5,99 cada'        WHERE nome = 'Avulso MEI';
UPDATE planos SET descricao_curta = 'Emissão de até 5 NFS-e por mês'               WHERE nome = 'MEI Mensal';
UPDATE planos SET descricao_curta = 'Emissão de até 15 NFS-e por mês'              WHERE nome = 'MEI Plus';
UPDATE planos SET descricao_curta = 'Emissão de até 100 NFS-e por mês'             WHERE nome = 'MEI Premium';
UPDATE planos SET descricao_curta = 'Emissão de até 10 NFS-e por mês'              WHERE nome = 'ME Start';
UPDATE planos SET descricao_curta = 'Emissão de até 50 NFS-e por mês'              WHERE nome = 'ME Pro';
UPDATE planos SET descricao_curta = 'Emissão de até 300 NFS-e por mês'             WHERE nome = 'ME Business';

-- Ordem de exibição padrão (preço crescente)
UPDATE planos SET ordem_exibicao = 0 WHERE nome IN ('Trial MEI', 'Trial ME', 'Trial EPP');
UPDATE planos SET ordem_exibicao = 1 WHERE nome IN ('Avulso MEI', 'MEI Mensal', 'ME Start');
UPDATE planos SET ordem_exibicao = 2 WHERE nome IN ('MEI Plus', 'ME Pro');
UPDATE planos SET ordem_exibicao = 3 WHERE nome IN ('MEI Premium', 'ME Business');

-- Marca o plano "mainstream" de cada categoria como destaque (default da UI)
UPDATE planos SET destaque = true WHERE nome IN ('MEI Plus', 'ME Pro');


-- ─── 5. Comentários ───────────────────────────────────────────────────────
COMMENT ON COLUMN planos.descricao_curta IS
    'Description usada no Stripe Checkout + landing cards. Editável em /admin/planos.';
COMMENT ON COLUMN planos.destaque IS
    'Marca o plano mais popular pra renderizar com badge "Recomendado" na landing.';
COMMENT ON COLUMN planos.ordem_exibicao IS
    'Ordem de renderização nos cards (menor primeiro). Default por preço crescente.';
COMMENT ON COLUMN planos.stripe_product_id IS
    'ID Stripe Product. NÃO editável manualmente — vinculado quando admin cria/syncs plano.';
COMMENT ON TABLE planos_history IS
    'Audit trail de mudanças em planos. Append-only via service role.';
