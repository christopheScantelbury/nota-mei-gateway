-- ─────────────────────────────────────────────────────────────────────────────
-- Stub do que o Supabase entrega pronto — SÓ para o CI (Postgres 15 puro).
--
-- As migrations referenciam objetos que não são criados por elas, e sim pela
-- plataforma (GoTrue / Storage API): schema auth, auth.users, auth.uid(),
-- roles anon/authenticated/service_role e storage.buckets. Num Postgres limpo
-- eles não existem, então o job "Supabase — migrations + seed" os cria aqui,
-- com o mínimo de colunas que as migrations usam.
--
-- NÃO é migration: fica fora de supabase/migrations/, o `supabase db push`
-- nunca lê este arquivo e ele nunca roda em produção. Num Supabase de verdade
-- (local ou hospedado) nada disto é necessário.
--
-- Usado por .github/workflows/ci.yml e ci-db.yml.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Roles do PostgREST ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

-- ── Auth (GoTrue) ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

-- Alvo das FKs `REFERENCES auth.users(id)` (empresas.user_id, admin_users, ...).
CREATE TABLE IF NOT EXISTS auth.users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULL::uuid $$;

-- ── Storage ──────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS storage;

-- Alvo dos `INSERT INTO storage.buckets` (suporte-anexos, notas-fiscais).
CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL UNIQUE,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
