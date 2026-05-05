-- Add tipo_usuario to meis table to distinguish MEI end-users from Gateway developers.
-- Default 'gateway' so existing registrations (all developer accounts) stay correct.

ALTER TABLE meis
  ADD COLUMN IF NOT EXISTS tipo_usuario VARCHAR(10) NOT NULL DEFAULT 'gateway'
    CHECK (tipo_usuario IN ('mei', 'gateway'));

COMMENT ON COLUMN meis.tipo_usuario IS
  'Tipo de usuário: "mei" = MEI usando Nota Fácil MEI, "gateway" = desenvolvedor usando a API';
