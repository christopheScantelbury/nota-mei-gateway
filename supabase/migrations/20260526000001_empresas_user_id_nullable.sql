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

ALTER TABLE empresas
    ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN empresas.user_id IS
    'UUID do auth.users correspondente. NULL para empresas ME/EPP registradas
     via API antes da primeira autenticação. Preenchido automaticamente no
     callback do Magic Link (/auth/callback).';
