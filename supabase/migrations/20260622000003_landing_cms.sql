-- ============================================================
-- Migration: landing_cms
-- CMS leve pras páginas /(landing) — sections em draft + live.
-- Implementa issue #239.
-- ============================================================

-- ─── 1. landing_pages — uma row por slug ──────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              VARCHAR(100) UNIQUE NOT NULL,
    -- slugs esperados: 'home', 'mei', 'me', 'gateway', 'comparativo', 'precos'
    title             VARCHAR(200),
    meta_description  TEXT,
    published         BOOLEAN      NOT NULL DEFAULT false,
    published_at      TIMESTAMPTZ,
    published_by      UUID         REFERENCES auth.users(id),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ─── 2. landing_sections — bloco renderizável (versão draft + live) ───────
-- Cada section tem 2 versões: a draft (editável) e a live (snapshot publicado).
-- Publicar = copiar draft para live + bump published_at.
CREATE TABLE IF NOT EXISTS landing_sections (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id       UUID         NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    tipo          VARCHAR(60)  NOT NULL,
    -- tipos: hero | pricing | features | faq | cta | testimonials |
    --        how_it_works | urgency_banner | competitor_table |
    --        ecossistema | custom_html
    ordem         INTEGER      NOT NULL DEFAULT 0,
    draft_data    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    live_data     JSONB,
    visible       BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_sections_page  ON landing_sections(page_id, ordem);
CREATE INDEX IF NOT EXISTS idx_landing_sections_visivel ON landing_sections(page_id) WHERE visible = true;


-- ─── 3. landing_assets — imagens uploadadas ───────────────────────────────
CREATE TABLE IF NOT EXISTS landing_assets (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id       UUID         REFERENCES landing_pages(id) ON DELETE SET NULL,
    kind          VARCHAR(20)  NOT NULL DEFAULT 'image',
    -- kind: image | logo | icon | og_image
    storage_path  TEXT         NOT NULL,
    public_url    TEXT         NOT NULL,
    alt_text      VARCHAR(255),
    width         INTEGER,
    height        INTEGER,
    size_bytes    BIGINT,
    uploaded_by   UUID         REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_assets_page ON landing_assets(page_id, created_at DESC);


-- ─── 4. landing_publish_history — versionamento (rollback) ────────────────
-- A cada publish, snapshot do live antigo é salvo aqui. Permite rollback.
CREATE TABLE IF NOT EXISTS landing_publish_history (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id           UUID         NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    published_by      UUID         REFERENCES auth.users(id),
    sections_snapshot JSONB        NOT NULL,
    -- array de {id, tipo, ordem, data, visible} no momento do publish anterior
    notes             TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_history_page ON landing_publish_history(page_id, created_at DESC);


-- ─── 5. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE landing_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_sections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_publish_history ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas do live_data (via funções/SSR direto). Aqui só admin.
CREATE POLICY "landing_pages_admin_read" ON landing_pages
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "landing_sections_admin_read" ON landing_sections
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "landing_assets_admin_read" ON landing_assets
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "landing_history_admin_read" ON landing_publish_history
    FOR SELECT USING (is_admin(auth.uid()));

-- Writes vêm via service role (API routes /admin/api/landing).


-- ─── 6. Seed: páginas iniciais ────────────────────────────────────────────
-- Cria os slugs que hoje existem em apps/web/app/(landing)/.
INSERT INTO landing_pages (slug, title, meta_description) VALUES
    ('home',         'NotaFácil — Emissão de NFS-e Nacional para MEI, ME e EPP',
                     'Emita NFS-e Nacional em segundos. Para MEI: app simples. Para ME/EPP: obrigatório a partir de set/2026. Para devs: API REST.'),
    ('mei',          'NotaFácil MEI — Emissão de NFS-e em segundos',
                     'O jeito mais simples de emitir NFS-e como MEI. Sem entender de imposto, sem cadastrar prefeitura.'),
    ('me',           'NotaFácil Empresa — NFS-e Nacional pra ME/EPP',
                     'Cumpra a obrigatoriedade NFS-e Nacional 2026. Multi-empresa, painel completo, API integrada.'),
    ('gateway',      'NotaFácil Gateway — API REST de NFS-e Nacional',
                     'API REST simples pra emitir NFS-e Nacional. SDKs Node, Python, PHP. Sandbox público sem cadastro.'),
    ('comparativo',  'NotaFácil vs concorrentes — Comparativo NFS-e Nacional',
                     'Compare NotaFácil com Focus NFe, eNotas e PlugNotas. Única plataforma 100% nativa para NFS-e Nacional.'),
    ('precos',       'Planos e preços — NotaFácil',
                     'MEI a partir de R$ 19,90/mês. ME/EPP a partir de R$ 59,99/mês. Trial grátis sem cartão.')
ON CONFLICT (slug) DO NOTHING;


-- ─── 7. Comentários ───────────────────────────────────────────────────────
COMMENT ON TABLE landing_pages           IS 'Páginas CMS da landing — uma por slug.';
COMMENT ON TABLE landing_sections        IS 'Blocos renderizáveis. draft_data editável; live_data = snapshot publicado.';
COMMENT ON TABLE landing_assets          IS 'Imagens uploadadas pro Supabase Storage (bucket landing-assets).';
COMMENT ON TABLE landing_publish_history IS 'Snapshot do live antes de cada publish (rollback).';
