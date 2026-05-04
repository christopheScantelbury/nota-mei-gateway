CREATE TABLE nota_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id        UUID NOT NULL REFERENCES meis(id) ON DELETE CASCADE,
  nome          VARCHAR(100) NOT NULL,
  descricao     TEXT,
  -- Stored as JSONB — mirrors the POST /v1/nfse payload shape
  servico       JSONB NOT NULL,
  tomador       JSONB,
  webhook_url   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON nota_templates(mei_id) WHERE ativo = true;

ALTER TABLE nota_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mei_own_templates" ON nota_templates
  FOR ALL USING (mei_id = auth.uid());
