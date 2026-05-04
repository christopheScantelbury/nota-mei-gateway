-- Migration: BE-03 – nota_recorrencias
-- Stores recurrence rules for automated monthly NFS-e re-emission.

CREATE TABLE nota_recorrencias (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id          UUID REFERENCES meis(id) ON DELETE CASCADE NOT NULL,
  nome            VARCHAR(100) NOT NULL,
  ativo           BOOLEAN DEFAULT true,
  dia_vencimento  SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 28),
  servico         JSONB NOT NULL,
  tomador         JSONB NOT NULL,
  webhook_url     TEXT,
  proxima_emissao DATE NOT NULL,
  ultima_emissao  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON nota_recorrencias(mei_id) WHERE ativo = true;
CREATE INDEX ON nota_recorrencias(proxima_emissao) WHERE ativo = true;

ALTER TABLE nota_recorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mei_own_recorrencias" ON nota_recorrencias
  FOR ALL USING (mei_id = auth.uid());
