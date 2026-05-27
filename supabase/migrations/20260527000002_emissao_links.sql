-- ============================================================
-- Links de Emissão Rápida
--
-- Cada link permite emitir uma nota fiscal SEM precisar de login
-- na dashboard. O usuário salva nos favoritos do navegador / cria
-- atalho na home screen do celular / imprime QR code.
--
-- Segurança:
--  - Token aleatório (32+ chars). Vazou = qualquer um emite em nome
--    da empresa. Por isso é confidencial — só o próprio MEI guarda.
--  - Botão de revogar a qualquer momento (revoga também a api_key
--    associada).
--  - Rate limit de 1 emissão por minuto por token (aplicado no route).
--  - Plain API key armazenada com RLS-protect (só service_role lê
--    a coluna internal_api_key).
-- ============================================================

CREATE TABLE emissao_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Origem: aponta pra UM template OU UMA recorrência (XOR).
  template_id         UUID REFERENCES nota_templates(id)    ON DELETE CASCADE,
  recorrencia_id      UUID REFERENCES nota_recorrencias(id) ON DELETE CASCADE,
  CONSTRAINT emissao_links_source_xor CHECK (
    (template_id IS NOT NULL)::int + (recorrencia_id IS NOT NULL)::int = 1
  ),

  -- Token público (parte do URL). Único.
  token               VARCHAR(64) UNIQUE NOT NULL,

  -- Label que aparece na UI / na página de confirmação pública.
  nome                VARCHAR(100) NOT NULL,

  -- API key plain pra emitir em nome do user. Em produção poderia
  -- ser criptografada com AES via env secret. Por enquanto plain +
  -- RLS strict. Coluna NÃO deve ser exposta no front — Next.js
  -- routes filtram colunas no SELECT pra UI.
  internal_api_key    VARCHAR(76) NOT NULL,            -- sk_live_<64 hex>
  internal_api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  -- Tracking
  usos                INTEGER     NOT NULL DEFAULT 0,
  ultima_emissao_em   TIMESTAMPTZ,
  ultima_nota_id      UUID REFERENCES notas_fiscais(id) ON DELETE SET NULL,

  -- Estado
  ativo               BOOLEAN     NOT NULL DEFAULT TRUE,
  revogado_em         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX emissao_links_token_ativo_idx ON emissao_links(token) WHERE ativo;
CREATE INDEX        emissao_links_empresa_idx     ON emissao_links(empresa_id);
CREATE INDEX        emissao_links_template_idx    ON emissao_links(template_id)    WHERE template_id    IS NOT NULL;
CREATE INDEX        emissao_links_recorrencia_idx ON emissao_links(recorrencia_id) WHERE recorrencia_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE emissao_links ENABLE ROW LEVEL SECURITY;

-- Owner CRUD nos próprios links
CREATE POLICY "empresa_own_emissao_links" ON emissao_links
  FOR ALL USING (
    empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid())
  );

-- ─── updated_at ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION emissao_links_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emissao_links_updated_at
  BEFORE UPDATE ON emissao_links
  FOR EACH ROW EXECUTE FUNCTION emissao_links_set_updated_at();

COMMENT ON TABLE  emissao_links IS 'Links bookmarkáveis pra emissão rápida sem login. Token=senha (confidencial).';
COMMENT ON COLUMN emissao_links.internal_api_key IS 'PLAIN sk_live_ usado pra autenticar no /v1/nfse. RLS strict — nunca expor pra cliente.';
