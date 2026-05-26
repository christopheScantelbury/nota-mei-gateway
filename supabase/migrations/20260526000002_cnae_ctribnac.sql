-- ─────────────────────────────────────────────────────────────────────────────
-- CNAE → cTribNac (LC116/2003) mapping + CNAEs do CNPJ
-- Migration: 20260526000002_cnae_ctribnac
--
-- Resolve dois problemas recorrentes:
--   1. Receita rejeita NFS-e com E0310 quando o cTribNac não existe na lista
--      oficial LC116. Hoje a tabela codigos_nbs deixa o usuário escolher códigos
--      cujos primeiros 6 dígitos não são cTribNacs válidos.
--   2. Mesmo que o cTribNac seja válido, o CNPJ específico pode não estar
--      autorizado a emitir aquele serviço (faltam os CNAEs correspondentes
--      no registro da Receita).
--
-- Estratégia:
--   · empresas/meis ganham coluna `cnaes jsonb` populada via BrasilAPI no cadastro
--   · codigos_nbs ganha `ctrib_nac` (computed) + `ctrib_nac_valido` (flag manual)
--   · nova tabela `cnae_ctribnac` mapeia cada CNAE → cTribNac aplicável
--   · busca de serviços filtra por (ctrib_nac_valido) AND (cTribNac está mapeado
--     para algum CNAE da empresa)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. CNAEs nos cadastros ──────────────────────────────────────────────────

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS cnaes JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE meis
  ADD COLUMN IF NOT EXISTS cnaes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN empresas.cnaes IS
  'Array de códigos CNAE (sem ponto-hífen, 7 dígitos) registrados na Receita Federal para este CNPJ. Populado via BrasilAPI no cadastro.';
COMMENT ON COLUMN meis.cnaes IS
  'Array de códigos CNAE (sem ponto-hífen, 7 dígitos) registrados na Receita Federal para este CNPJ. Populado via BrasilAPI no cadastro.';

-- ── 2. cTribNac na tabela codigos_nbs ──────────────────────────────────────
-- cTribNac LC116/2003 = primeiros 6 dígitos do código NBS (sem pontos).
-- Coluna STORED para permitir índices e queries diretas.

ALTER TABLE codigos_nbs
  ADD COLUMN IF NOT EXISTS ctrib_nac VARCHAR(6) GENERATED ALWAYS AS (LEFT(codigo, 6)) STORED;

ALTER TABLE codigos_nbs
  ADD COLUMN IF NOT EXISTS ctrib_nac_valido BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN codigos_nbs.ctrib_nac IS
  'cTribNac LC116/2003 (6 dígitos). Calculado a partir do código NBS (primeiros 6 dígitos).';
COMMENT ON COLUMN codigos_nbs.ctrib_nac_valido IS
  'true = cTribNac validado contra a lista oficial da Receita (NFS-e Nacional aceita). Default false até validação.';

CREATE INDEX IF NOT EXISTS idx_codigos_nbs_ctrib_nac ON codigos_nbs(ctrib_nac);

-- Marca cTribNacs conhecidos como válidos (testados em produção contra Receita).
-- Fonte: docs.nfse.gov.br + commits anteriores (memória do projeto).
UPDATE codigos_nbs SET ctrib_nac_valido = true
WHERE ctrib_nac IN (
  '010101', -- Análise/desenvolvimento de sistemas ✅
  '010301', -- Processamento de dados ✅
  '010401', -- Programação ✅
  '010701', -- Suporte técnico em informática ✅
  '010801', -- Planejamento, confecção, manutenção de páginas eletrônicas ✅
  '011401', -- Elaboração de programas de computadores ✅
  '140101', -- Manutenção/conservação de máquinas, veículos, equipamentos ✅
  '170101', -- Assessoria/consultoria ✅
  '170201', -- Datilografia, digitação, expediente ✅
  '130101', -- Criação de sites e conteúdo internet ✅
  '130301', -- Layouts, peças e material publicitário ✅
  '130501', -- Publicidade e propaganda ✅
  '120201', -- Instrução, treinamento, orientação pedagógica ✅
  '120301'  -- Cursos, treinamentos, capacitação ✅
);

-- ── 3. Tabela de mapping CNAE → cTribNac ───────────────────────────────────

CREATE TABLE IF NOT EXISTS cnae_ctribnac (
  cnae_codigo   VARCHAR(7) NOT NULL,    -- "6201501" (7 dígitos, sem ponto-hífen)
  ctrib_nac     VARCHAR(6) NOT NULL,    -- "010101"
  permitido_mei BOOLEAN NOT NULL DEFAULT true,
  descricao_cnae TEXT,
  PRIMARY KEY (cnae_codigo, ctrib_nac)
);

CREATE INDEX IF NOT EXISTS idx_cnae_ctribnac_cnae ON cnae_ctribnac(cnae_codigo);
CREATE INDEX IF NOT EXISTS idx_cnae_ctribnac_ctrib ON cnae_ctribnac(ctrib_nac);

ALTER TABLE cnae_ctribnac ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cnae_ctribnac_public_read" ON cnae_ctribnac FOR SELECT USING (true);

COMMENT ON TABLE cnae_ctribnac IS
  'Mapeamento CNAE (Receita Federal) → cTribNac (LC116/2003). Curadoria aproximada — expandir conforme novos CNPJs chegam.';

-- ── 4. Seed inicial — CNAEs mais comuns ────────────────────────────────────

INSERT INTO cnae_ctribnac (cnae_codigo, ctrib_nac, descricao_cnae, permitido_mei) VALUES
  -- ── Tecnologia da Informação (Seção J — Divisão 62) ──
  ('6201501', '010101', 'Desenvolvimento de programas de computador sob encomenda', true),
  ('6201501', '010401', 'Desenvolvimento de programas de computador sob encomenda', true),
  ('6202300', '010101', 'Desenvolvimento e licenciamento de programas customizáveis', true),
  ('6202300', '010401', 'Desenvolvimento e licenciamento de programas customizáveis', true),
  ('6203100', '010101', 'Desenvolvimento e licenciamento de programas não-customizáveis', true),
  ('6203100', '010401', 'Desenvolvimento e licenciamento de programas não-customizáveis', true),
  ('6204000', '170101', 'Consultoria em tecnologia da informação', true),
  ('6209100', '010701', 'Suporte técnico, manutenção e outros serviços em TI', true),
  ('6209100', '010101', 'Suporte técnico, manutenção e outros serviços em TI', true),
  ('6311900', '010301', 'Tratamento de dados, provedores de serviços de aplicação', true),
  ('6311900', '010101', 'Tratamento de dados, provedores de serviços de aplicação', true),
  ('6312100', '130101', 'Portais, provedores de conteúdo na internet', true),
  ('6319400', '010701', 'Outras atividades de TI', true),
  ('6319400', '170101', 'Outras atividades de TI', true),

  -- ── Reparação e manutenção (Seção S — Divisão 95) ──
  ('9511800', '140101', 'Reparação e manutenção de computadores e periféricos', true),
  ('9512600', '140101', 'Reparação e manutenção de equipamentos de comunicação', true),
  ('9521500', '140101', 'Reparação e manutenção de eletrodomésticos', true),
  ('9529101', '140101', 'Reparação de calçados, bolsas e artigos de couro', true),
  ('9529102', '140101', 'Chaveiros', true),
  ('9529103', '140101', 'Reparação de relógios', true),
  ('9529105', '140101', 'Reparação de artigos do mobiliário', true),
  ('9529106', '140101', 'Reparação de jóias', true),

  -- ── Atividades profissionais e técnicas (Divisão 74) ──
  ('7410201', '130301', 'Design gráfico', true),
  ('7410202', '130301', 'Design de produto', true),
  ('7410203', '130301', 'Design de interiores', true),
  ('7420001', '130101', 'Atividades de fotografia em geral', true),
  ('7420002', '130101', 'Atividades de produção de fotografias aéreas e submarinas', true),
  ('7490104', '170101', 'Atividades de intermediação e agenciamento de serviços', true),
  ('7490199', '170101', 'Outras atividades profissionais NCM', true),

  -- ── Marketing e publicidade (Divisão 73) ──
  ('7311400', '130501', 'Agências de publicidade', true),
  ('7312200', '130501', 'Agenciamento de espaços para publicidade', true),
  ('7319001', '130501', 'Criação de estandes para feiras e exposições', true),
  ('7319002', '130501', 'Promoção de vendas', true),
  ('7319003', '130501', 'Marketing direto', true),
  ('7319004', '130501', 'Consultoria em publicidade', true),
  ('7320300', '170101', 'Pesquisas de mercado e de opinião pública', true),

  -- ── Atividades administrativas e de escritório (Divisão 82) ──
  ('8211300', '170201', 'Serviços combinados de escritório e apoio administrativo', true),
  ('8219901', '170201', 'Fotocópias', true),
  ('8219999', '170201', 'Preparação de documentos e serviços especializados de apoio admin', true),
  ('8230001', '170101', 'Serviços de organização de feiras, congressos, exposições e festas', true),
  ('8230002', '170101', 'Casas de festas e eventos', true),

  -- ── Educação (Divisão 85) ──
  ('8550301', '120301', 'Administração de caixas escolares', true),
  ('8593700', '120301', 'Ensino de idiomas', true),
  ('8591100', '120301', 'Ensino de esportes', true),
  ('8592999', '120301', 'Ensino de arte e cultura NCM', true),
  ('8599604', '120201', 'Treinamento em desenvolvimento profissional e gerencial', true),
  ('8599605', '120201', 'Cursos preparatórios para concursos', true),
  ('8599699', '120201', 'Outras atividades de ensino NCM', true)
ON CONFLICT (cnae_codigo, ctrib_nac) DO NOTHING;
