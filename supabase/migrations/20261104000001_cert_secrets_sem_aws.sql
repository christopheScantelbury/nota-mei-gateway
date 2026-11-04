-- Certificados A1 e arquivos fiscais fora da AWS (conta encerrada em 2026-11-03).
--
-- 1. cert_secrets: certificados A1 cifrados (AES-256-GCM) pela API; a chave-mestra
--    fica só na CERT_MASTER_KEY do Railway. O banco nunca vê o certificado em claro.
--    RLS ligado e SEM políticas: só a API (role postgres/service_role) acessa.
-- 2. Bucket privado notas-fiscais no Supabase Storage para XML/PDF (substitui o S3).
-- 3. Os certificados que estavam no Secrets Manager se perderam com a conta.
--    Guardamos os ponteiros antigos em backup e limpamos cert_secret_arn /
--    cert_valid_until, para o painel pedir o reenvio em vez de fingir que há
--    certificado válido.

CREATE TABLE IF NOT EXISTS cert_secrets (
  ref          TEXT PRIMARY KEY,          -- valor gravado em meis/empresas.cert_secret_arn ("db:...")
  sealed       BYTEA NOT NULL,            -- nonce(12) || ciphertext || tag (AES-256-GCM, AAD = ref)
  key_version  SMALLINT NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cert_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cert_secrets FROM anon, authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS cert_aws_legado (
  tabela            TEXT NOT NULL,
  id                UUID NOT NULL,
  cert_secret_arn   TEXT,
  cert_valid_until  TIMESTAMPTZ,
  migrado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tabela, id)
);
ALTER TABLE cert_aws_legado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cert_aws_legado FROM anon, authenticated;

INSERT INTO cert_aws_legado (tabela, id, cert_secret_arn, cert_valid_until)
SELECT 'meis', id, cert_secret_arn, cert_valid_until FROM meis WHERE cert_secret_arn LIKE 'arn:aws:%'
ON CONFLICT DO NOTHING;
INSERT INTO cert_aws_legado (tabela, id, cert_secret_arn, cert_valid_until)
SELECT 'empresas', id, cert_secret_arn, cert_valid_until FROM empresas WHERE cert_secret_arn LIKE 'arn:aws:%'
ON CONFLICT DO NOTHING;

UPDATE meis     SET cert_secret_arn = NULL, cert_valid_until = NULL WHERE cert_secret_arn LIKE 'arn:aws:%';
UPDATE empresas SET cert_secret_arn = NULL, cert_valid_until = NULL WHERE cert_secret_arn LIKE 'arn:aws:%';
