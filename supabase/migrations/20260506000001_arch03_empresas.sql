-- ─────────────────────────────────────────────────────────────────────────────
-- ARCH-03 — Tabela empresas: generalização do modelo MEI → ME / EPP
-- Migration: 20260506000001_arch03_empresas
--
-- Estratégia zero-downtime (sem breaking change):
--   1. CREATE TABLE empresas                        (aditivo)
--   2. INSERT meis → empresas preservando UUIDs     (retrocompatibilidade)
--   3. ADD COLUMN empresa_id nullable               (aditivo)
--   4. UPDATE empresa_id = mei_id                   (UUIDs idênticos para MEIs)
--   5. SET NOT NULL + FKs + índices
--   6. RLS policies para empresa_id                 (coexistem com mei_id)
--
-- ⚠️  tabela meis NÃO É REMOVIDA nesta migration.
--     DROP agendado para sprint +2 após validação completa em produção.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela empresas ────────────────────────────────────────────────────────

CREATE TABLE empresas (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo societário e regime fiscal — campos que não existem em meis.
  tipo               VARCHAR(10)  NOT NULL
                       CHECK (tipo IN ('MEI','ME','EPP')),
  regime_tributario  VARCHAR(30)  NOT NULL
                       CHECK (regime_tributario IN (
                         'SIMPLES_MEI',
                         'SIMPLES_NACIONAL',
                         'LUCRO_PRESUMIDO',
                         'LUCRO_REAL'
                       )),

  -- Campos idênticos a meis (espelho para retrocompatibilidade).
  cnpj               VARCHAR(14)  UNIQUE NOT NULL,
  razao_social       VARCHAR(255) NOT NULL,
  email              VARCHAR(255) UNIQUE NOT NULL,
  municipio_ibge     VARCHAR(7)   NOT NULL,
  cert_secret_arn    TEXT,
  cert_valid_until   TIMESTAMPTZ,           -- copiado de meis.cert_valid_until
  stripe_customer_id VARCHAR(255) UNIQUE,
  tipo_usuario       VARCHAR(10)  NOT NULL DEFAULT 'gateway'
                       CHECK (tipo_usuario IN ('mei','gateway')),

  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Trigger updated_at (função já existe desde migration 20260426000001).
CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON empresas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Partial unique index: stripe_customer_id é único quando preenchido.
CREATE UNIQUE INDEX idx_empresas_stripe_customer_id
  ON empresas(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE  empresas                   IS 'Entidade empresarial unificada (MEI/ME/EPP). Substitui meis a partir do sprint ME-01.';
COMMENT ON COLUMN empresas.tipo              IS 'Tipo societário: MEI | ME | EPP';
COMMENT ON COLUMN empresas.regime_tributario IS 'Regime fiscal: SIMPLES_MEI | SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL';
COMMENT ON COLUMN empresas.cert_valid_until  IS 'Data de validade do certificado A1 mais recente. NULL = sem certificado enviado.';
COMMENT ON COLUMN empresas.tipo_usuario      IS '"mei" = usuário Nota Fácil MEI, "gateway" = desenvolvedor da API';

-- ── 2. Migrar todos os MEIs → empresas preservando UUIDs ──────────────────────
--
-- Como o UUID de cada MEI é preservado em empresas.id:
--   empresa_id == mei_id  para TODAS as linhas existentes
-- Isso significa que nenhuma FK nas tabelas dependentes precisa de mapeamento;
-- um simples `SET empresa_id = mei_id` preenche tudo corretamente.
--
-- ON CONFLICT (id) DO NOTHING garante idempotência: re-run não falha.

INSERT INTO empresas (
  id,
  tipo,
  regime_tributario,
  cnpj,
  razao_social,
  email,
  municipio_ibge,
  cert_secret_arn,
  cert_valid_until,
  stripe_customer_id,
  tipo_usuario,
  created_at,
  updated_at
)
SELECT
  id,
  'MEI'         AS tipo,
  'SIMPLES_MEI' AS regime_tributario,
  cnpj,
  razao_social,
  email,
  municipio_ibge,
  cert_secret_arn,
  cert_valid_until,
  stripe_customer_id,
  tipo_usuario,
  created_at,
  updated_at
FROM meis
ON CONFLICT (id) DO NOTHING;

-- ── 3. Adicionar empresa_id nas tabelas dependentes (nullable — sem downtime) ──

ALTER TABLE api_keys         ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE emissoes_mensais ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE notas_fiscais    ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE RESTRICT;
ALTER TABLE rps_sequences    ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;

-- ── 4. Preencher empresa_id = mei_id (UUIDs idênticos para todos os MEIs) ──────

UPDATE api_keys         SET empresa_id = mei_id WHERE empresa_id IS NULL AND mei_id IS NOT NULL;
UPDATE emissoes_mensais SET empresa_id = mei_id WHERE empresa_id IS NULL AND mei_id IS NOT NULL;
UPDATE notas_fiscais    SET empresa_id = mei_id WHERE empresa_id IS NULL AND mei_id IS NOT NULL;
UPDATE rps_sequences    SET empresa_id = mei_id WHERE empresa_id IS NULL AND mei_id IS NOT NULL;

-- ── 5. NOT NULL + índices ──────────────────────────────────────────────────────
--
-- Seguro pois o passo 4 garantiu que todas as linhas existentes têm empresa_id.
-- Novas inserções por ME/EPP devem fornecer empresa_id diretamente.

ALTER TABLE api_keys         ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE emissoes_mensais ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE notas_fiscais    ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE rps_sequences    ALTER COLUMN empresa_id SET NOT NULL;

-- Unique: uma emissão por empresa por competência (espelha UNIQUE(mei_id, competencia)).
ALTER TABLE emissoes_mensais
  ADD CONSTRAINT uq_emissoes_empresa_competencia UNIQUE (empresa_id, competencia);

-- Índices de busca para queries por empresa_id (espelham os de mei_id).
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_empresa_competencia
  ON notas_fiscais (empresa_id, competencia);

CREATE INDEX IF NOT EXISTS idx_emissoes_mensais_empresa_competencia
  ON emissoes_mensais (empresa_id, competencia);

-- rps_sequences: empresa_id único (uma sequência RPS por empresa).
CREATE UNIQUE INDEX IF NOT EXISTS idx_rps_sequences_empresa_id
  ON rps_sequences (empresa_id);

-- ── 6. RLS — habilitar empresas + políticas empresa_id ────────────────────────
--
-- Políticas novas coexistem com as políticas mei_id já existentes.
-- Em Supabase, duas políticas permissivas na mesma tabela são combinadas com OR:
-- um usuário acessa a linha se satisfizer QUALQUER uma das condições.
-- Com empresa_id == mei_id para todos os MEIs, o comportamento é idêntico.

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_own_data" ON empresas
  FOR ALL USING (id = auth.uid());

-- api_keys: empresa_id = auth.uid() (ME/EPP — coexiste com mei_id policy)
CREATE POLICY "empresa_own_api_keys" ON api_keys
  FOR ALL USING (empresa_id = auth.uid());

-- emissoes_mensais: empresa_id = auth.uid()
CREATE POLICY "empresa_own_emissoes" ON emissoes_mensais
  FOR ALL USING (empresa_id = auth.uid());

-- notas_fiscais: empresa_id = auth.uid()
CREATE POLICY "empresa_own_notas" ON notas_fiscais
  FOR ALL USING (empresa_id = auth.uid());

-- rps_sequences usa service_role (Go backend); sem policy de usuário.
