-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: empresas.user_id nullable para registro ME/EPP via Go API
-- Migration: 20260526000001_empresas_user_id_nullable
--
-- Contexto:
--   A migration multi_produto (20260620) adicionou user_id NOT NULL em empresas.
--   O endpoint público POST /v1/auth/register/me registra a empresa ANTES de
--   criar a conta Supabase Auth — portanto não tem user_id no momento do INSERT.
--
-- Fix:
--   1. Torna user_id nullable (DROP NOT NULL).
--   2. O auth callback (/auth/callback) linka user_id = auth.uid() na primeira
--      autenticação do usuário ME/EPP (empresa encontrada por email).
-- ─────────────────────────────────────────────────────────────────────────────

-- Ordem em banco limpo (CI, `supabase db reset`):
--   A multi_produto foi criada em 2026-05-07 com data futura no nome
--   (20260620), então ESTE arquivo — criado depois, em 2026-05-26 — é aplicado
--   ANTES dela quando as migrations rodam por ordem de nome. Num banco limpo a
--   coluna ainda não existe aqui, e este arquivo e as policies de 20260526000003,
--   20260527000001 e 20260527000002 quebravam com `column "user_id" does not
--   exist`. Por isso a coluna é garantida aqui, com a mesma definição da
--   multi_produto. Em produção ela já existe: o ADD COLUMN IF NOT EXISTS é no-op.
ALTER TABLE empresas
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE empresas
    ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN empresas.user_id IS
    'UUID do auth.users correspondente. NULL para empresas ME/EPP registradas
     via API antes da primeira autenticação. Preenchido automaticamente no
     callback do Magic Link (/auth/callback).';
