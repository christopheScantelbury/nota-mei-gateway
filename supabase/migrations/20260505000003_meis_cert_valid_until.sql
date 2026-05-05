-- Add cert_valid_until to meis so the dashboard can display certificate expiry.
-- Nullable: MEIs without a certificate uploaded yet have NULL.

ALTER TABLE meis
  ADD COLUMN IF NOT EXISTS cert_valid_until TIMESTAMPTZ;

COMMENT ON COLUMN meis.cert_valid_until IS
  'Data de validade do certificado A1 mais recente. NULL se nenhum certificado foi enviado.';
