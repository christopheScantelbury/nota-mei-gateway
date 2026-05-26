-- ============================================================
-- Migration: clientes (tomadores cadastrados)
-- Tabela de clientes/tomadores, alimentada automaticamente via
-- trigger toda vez que uma nota é AUTORIZADA pela Receita.
-- Plan gate (UI): Starter+ leitura+autocomplete, Pro+ CRUD.
-- ============================================================

-- ─── 1. Tabela ──────────────────────────────────────────────

CREATE TABLE clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Identidade (PJ tem CNPJ=14 dígitos; PF tem CPF=11)
  tipo            VARCHAR(2)   NOT NULL CHECK (tipo IN ('PJ','PF')),
  documento       VARCHAR(14)  NOT NULL,            -- só dígitos
  razao_social    VARCHAR(255) NOT NULL,
  nome_fantasia   VARCHAR(255),
  email           VARCHAR(255),
  telefone        VARCHAR(20),

  -- Endereço (NFS-e exige municipio_ibge na emissão; clientes podem
  -- ter dados parciais até serem completados na primeira edição)
  municipio_ibge  VARCHAR(7),
  uf              VARCHAR(2),
  cep             VARCHAR(8),
  logradouro      VARCHAR(255),
  numero          VARCHAR(20),
  complemento     VARCHAR(100),
  bairro          VARCHAR(100),

  -- Dados fiscais
  inscricao_estadual  VARCHAR(20),
  inscricao_municipal VARCHAR(20),

  -- Organização (Pro/Business)
  tags            TEXT[] NOT NULL DEFAULT '{}',
  observacoes     TEXT,

  -- Agregados em cache (atualizados pelo trigger)
  total_emitido_brl   DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_notas         INTEGER       NOT NULL DEFAULT 0,
  primeira_emissao_em TIMESTAMPTZ,
  ultima_emissao_em   TIMESTAMPTZ,

  -- Soft delete (preserva histórico fiscal)
  ativo           BOOLEAN     NOT NULL DEFAULT TRUE,
  arquivado_em    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT clientes_documento_digits CHECK (documento ~ '^[0-9]+$'),
  CONSTRAINT clientes_doc_len CHECK (
    (tipo = 'PJ' AND length(documento) = 14) OR
    (tipo = 'PF' AND length(documento) = 11)
  )
);

-- Unicidade por documento dentro da empresa (apenas registros ativos —
-- permite arquivar e recriar caso necessário).
CREATE UNIQUE INDEX clientes_empresa_doc_ativo_unique
  ON clientes (empresa_id, documento) WHERE ativo;

-- Buscas comuns
CREATE INDEX clientes_empresa_razao_idx ON clientes (empresa_id, razao_social);
CREATE INDEX clientes_empresa_ativo_idx ON clientes (empresa_id) WHERE ativo;
CREATE INDEX clientes_tags_idx          ON clientes USING GIN (tags);

-- ─── 2. FK opcional em notas_fiscais ────────────────────────

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notas_fiscais_cliente_id_idx ON notas_fiscais(cliente_id);

-- ─── 3. RLS ─────────────────────────────────────────────────

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_own_clientes" ON clientes
  FOR ALL USING (
    empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid())
  );

-- ─── 4. Trigger: upsert cliente quando nota é AUTORIZADA ────

CREATE OR REPLACE FUNCTION upsert_cliente_from_nota() RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id  UUID;
  v_tipo        VARCHAR(2);
  v_cliente_id  UUID;
  v_doc_clean   VARCHAR(14);
BEGIN
  -- Pega o owner. No schema atual id de empresa == auth.uid() pra MEI legado
  -- e empresa_id != mei_id pra ME/EPP. Usa empresa_id se houver, senão mei_id.
  v_empresa_id := COALESCE(NEW.empresa_id, NEW.mei_id);
  IF v_empresa_id IS NULL OR NEW.tomador_doc IS NULL OR NEW.tomador_nome IS NULL THEN
    RETURN NEW;
  END IF;

  -- Limpa documento (só dígitos) — algumas notas podem ter sido salvas com formatação
  v_doc_clean := regexp_replace(NEW.tomador_doc, '[^0-9]', '', 'g');
  IF length(v_doc_clean) NOT IN (11, 14) THEN
    RETURN NEW;
  END IF;
  v_tipo := CASE WHEN length(v_doc_clean) = 14 THEN 'PJ' ELSE 'PF' END;

  -- Garante que existe a linha de empresa (FK)
  IF NOT EXISTS (SELECT 1 FROM empresas WHERE id = v_empresa_id) THEN
    RETURN NEW;
  END IF;

  -- Upsert + agrega
  INSERT INTO clientes (
    empresa_id, tipo, documento, razao_social,
    total_emitido_brl, total_notas,
    primeira_emissao_em, ultima_emissao_em
  ) VALUES (
    v_empresa_id, v_tipo, v_doc_clean, NEW.tomador_nome,
    COALESCE(NEW.valor_servico, 0), 1,
    COALESCE(NEW.emitida_em, NEW.created_at),
    COALESCE(NEW.emitida_em, NEW.created_at)
  )
  ON CONFLICT (empresa_id, documento) WHERE ativo
  DO UPDATE SET
    razao_social        = EXCLUDED.razao_social,  -- atualiza com o nome mais recente
    total_emitido_brl   = clientes.total_emitido_brl + EXCLUDED.total_emitido_brl,
    total_notas         = clientes.total_notas + 1,
    ultima_emissao_em   = GREATEST(clientes.ultima_emissao_em, EXCLUDED.ultima_emissao_em),
    primeira_emissao_em = LEAST(
      COALESCE(clientes.primeira_emissao_em, EXCLUDED.primeira_emissao_em),
      EXCLUDED.primeira_emissao_em
    ),
    updated_at          = NOW()
  RETURNING id INTO v_cliente_id;

  -- Linka a nota ao cliente (campo cliente_id na mesma linha) sem refire do trigger
  IF v_cliente_id IS NOT NULL AND (NEW.cliente_id IS NULL OR NEW.cliente_id <> v_cliente_id) THEN
    UPDATE notas_fiscais SET cliente_id = v_cliente_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger só dispara quando o status passa pra AUTORIZADA — evita poluir
-- a lista com tentativas rejeitadas pela Receita.
CREATE TRIGGER notas_fiscais_upsert_cliente
  AFTER INSERT OR UPDATE OF status ON notas_fiscais
  FOR EACH ROW
  WHEN (NEW.status = 'AUTORIZADA')
  EXECUTE FUNCTION upsert_cliente_from_nota();

-- ─── 5. Backfill: cria clientes do histórico ────────────────
-- Agrega todas as notas AUTORIZADAS existentes por (empresa_id, documento),
-- pega o nome mais recente e cria os clientes com agregados corretos.

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH src AS (
    SELECT
      COALESCE(empresa_id, mei_id) AS empresa_id,
      regexp_replace(tomador_doc, '[^0-9]', '', 'g') AS doc_clean,
      tomador_nome,
      valor_servico,
      COALESCE(emitida_em, created_at) AS emitida_em
    FROM notas_fiscais
    WHERE status = 'AUTORIZADA'
      AND tomador_doc IS NOT NULL
      AND tomador_nome IS NOT NULL
      AND COALESCE(empresa_id, mei_id) IS NOT NULL
  ),
  agg AS (
    SELECT
      empresa_id,
      doc_clean AS documento,
      CASE WHEN length(doc_clean) = 14 THEN 'PJ'
           WHEN length(doc_clean) = 11 THEN 'PF'
           ELSE NULL END AS tipo,
      (array_agg(tomador_nome  ORDER BY emitida_em DESC NULLS LAST))[1] AS razao_social,
      COALESCE(SUM(valor_servico), 0)::DECIMAL(12,2) AS total_emitido,
      COUNT(*)::INTEGER AS total_notas,
      MIN(emitida_em) AS primeira,
      MAX(emitida_em) AS ultima
    FROM src
    WHERE length(doc_clean) IN (11, 14)
    GROUP BY empresa_id, doc_clean
  )
  INSERT INTO clientes (
    empresa_id, tipo, documento, razao_social,
    total_emitido_brl, total_notas,
    primeira_emissao_em, ultima_emissao_em
  )
  SELECT
    empresa_id, tipo, documento, razao_social,
    total_emitido, total_notas, primeira, ultima
  FROM agg
  WHERE tipo IS NOT NULL
    AND empresa_id IN (SELECT id FROM empresas)
  ON CONFLICT (empresa_id, documento) WHERE ativo DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'clientes: backfill criou % linhas', v_count;
END $$;

-- Linka notas existentes aos clientes recém-criados
UPDATE notas_fiscais nf
SET cliente_id = c.id
FROM clientes c
WHERE c.empresa_id = COALESCE(nf.empresa_id, nf.mei_id)
  AND c.documento  = regexp_replace(nf.tomador_doc, '[^0-9]', '', 'g')
  AND c.ativo
  AND nf.cliente_id IS NULL
  AND nf.tomador_doc IS NOT NULL;

-- ─── 6. updated_at trigger (padrão do projeto) ──────────────

CREATE OR REPLACE FUNCTION clientes_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION clientes_set_updated_at();

-- ─── 7. Comentários (documentação inline) ───────────────────

COMMENT ON TABLE  clientes IS 'Tomadores cadastrados — alimentado por trigger ao autorizar nota. Plan gate (UI): Starter+ leitura, Pro+ CRUD.';
COMMENT ON COLUMN clientes.documento IS 'CNPJ (14) ou CPF (11), só dígitos';
COMMENT ON COLUMN clientes.tipo IS 'PJ (Pessoa Jurídica) ou PF (Pessoa Física)';
COMMENT ON COLUMN clientes.total_emitido_brl IS 'Soma de valor_servico das notas autorizadas — cache mantido pelo trigger';
COMMENT ON COLUMN clientes.ativo IS 'Soft delete; FALSE não apaga notas históricas vinculadas';
COMMENT ON COLUMN notas_fiscais.cliente_id IS 'FK opcional para clientes; preenchido pelo trigger upsert_cliente_from_nota';
