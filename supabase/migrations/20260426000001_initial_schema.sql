-- ─────────────────────────────────────────────────────────────────────────────
-- Nota MEI Gateway — Schema inicial
-- Migration: 20260426000001_initial_schema
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Trigger: updated_at automático ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── MEIs ─────────────────────────────────────────────────────────────────────
CREATE TABLE meis (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj               VARCHAR(14) UNIQUE NOT NULL,
  razao_social       VARCHAR(255) NOT NULL,
  email              VARCHAR(255) UNIQUE NOT NULL,
  municipio_ibge     VARCHAR(7)  NOT NULL,
  cert_secret_arn    TEXT,
  stripe_customer_id VARCHAR(255) UNIQUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_meis_updated_at
  BEFORE UPDATE ON meis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── API Keys ──────────────────────────────────────────────────────────────────
CREATE TABLE api_keys (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id     UUID        REFERENCES meis(id) ON DELETE CASCADE,
  key_hash   VARCHAR(64) UNIQUE NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  label      VARCHAR(100),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Planos ────────────────────────────────────────────────────────────────────
CREATE TABLE planos (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                VARCHAR(50)    NOT NULL,
  emissoes_limite     INTEGER        NOT NULL,
  preco_mensal_brl    DECIMAL(10,2),
  preco_excedente_brl DECIMAL(10,4),
  stripe_price_id     VARCHAR(255),
  stripe_product_id   VARCHAR(255),
  ativo               BOOLEAN        DEFAULT true
);

-- ── Emissões mensais ──────────────────────────────────────────────────────────
CREATE TABLE emissoes_mensais (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id                      UUID        REFERENCES meis(id) ON DELETE CASCADE,
  plano_id                    UUID        REFERENCES planos(id),
  competencia                 VARCHAR(7)  NOT NULL,
  total_emitidas              INTEGER     DEFAULT 0,
  stripe_subscription_id      VARCHAR(255),
  stripe_subscription_status  VARCHAR(50),
  stripe_subscription_item_id VARCHAR(255),
  renovacao_em                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mei_id, competencia)
);

-- ── Notas fiscais ─────────────────────────────────────────────────────────────
CREATE TABLE notas_fiscais (
  id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  mei_id             UUID           REFERENCES meis(id) ON DELETE RESTRICT,
  numero_rps         BIGINT         NOT NULL,
  status             VARCHAR(20)    NOT NULL DEFAULT 'PROCESSANDO',
  protocolo_receita  VARCHAR(100),
  numero_nfse        VARCHAR(50),
  codigo_verificacao VARCHAR(50),
  xml_enviado        TEXT,
  xml_retorno        TEXT,
  pdf_path           TEXT,
  webhook_url        TEXT,
  webhook_entregue   BOOLEAN        DEFAULT false,
  webhook_tentativas INTEGER        DEFAULT 0,
  idempotency_key    VARCHAR(255)   UNIQUE,
  tomador_doc        VARCHAR(14),
  tomador_nome       VARCHAR(255),
  valor_servico      DECIMAL(12,2),
  competencia        VARCHAR(7),
  erro_codigo        VARCHAR(20),
  erro_descricao     TEXT,
  cancelada_em       TIMESTAMPTZ,
  emitida_em         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ    DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    DEFAULT NOW(),
  CONSTRAINT status_values CHECK (status IN ('PROCESSANDO','AUTORIZADA','REJEITADA','CANCELADA','ERRO_TEMPORARIO'))
);

CREATE TRIGGER trg_notas_updated_at
  BEFORE UPDATE ON notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Eventos Stripe (deduplicação) ─────────────────────────────────────────────
CREATE TABLE stripe_events (
  stripe_event_id VARCHAR(255) PRIMARY KEY,
  tipo            VARCHAR(100),
  processado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices críticos ──────────────────────────────────────────────────────────
CREATE UNIQUE INDEX ON api_keys(key_hash);
CREATE INDEX ON notas_fiscais(mei_id, competencia);
CREATE INDEX ON notas_fiscais(status) WHERE status = 'PROCESSANDO';
CREATE INDEX ON emissoes_mensais(mei_id, competencia);
CREATE UNIQUE INDEX ON meis(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE meis              ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE emissoes_mensais  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas_fiscais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events     ENABLE ROW LEVEL SECURITY;

-- Policy padrão: MEI só acessa seus próprios dados (via JWT Supabase Auth)
CREATE POLICY "mei_own_data_notas" ON notas_fiscais
  FOR ALL USING (mei_id = auth.uid());

CREATE POLICY "mei_own_data_api_keys" ON api_keys
  FOR ALL USING (mei_id = auth.uid());

CREATE POLICY "mei_own_data_emissoes" ON emissoes_mensais
  FOR ALL USING (mei_id = auth.uid());

CREATE POLICY "mei_own_data_meis" ON meis
  FOR ALL USING (id = auth.uid());

-- Planos são públicos (leitura)
CREATE POLICY "planos_public_read" ON planos
  FOR SELECT USING (true);
