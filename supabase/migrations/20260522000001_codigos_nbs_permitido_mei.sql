-- ─────────────────────────────────────────────────────────────────────────────
-- Busca de serviços por nome + filtro por categoria de empresa
-- Migration: 20260522000001_codigos_nbs_permitido_mei
--
-- Adiciona a flag permitido_mei em codigos_nbs para que o dashboard possa
-- oferecer um seletor de serviço por NOME, filtrando os códigos disponíveis
-- conforme a categoria da empresa:
--   · MEI    → apenas serviços permitidos ao MEI (permitido_mei = true)
--   · ME/EPP → todos os serviços
--
-- ⚠️  A curadoria abaixo é APROXIMADA (não-oficial). Profissões regulamentadas
--     (saúde, engenharia/arquitetura, veterinária, ensino regular, corretagem,
--     serviços financeiros) não podem ser exercidas como MEI e são marcadas
--     como false. Refinar contra o Anexo XI da Resolução CGSN quando possível.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE codigos_nbs
  ADD COLUMN IF NOT EXISTS permitido_mei BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN codigos_nbs.permitido_mei IS
  'true = serviço pode ser prestado por MEI. false = profissão regulamentada / atividade vedada ao MEI. Curadoria aproximada.';

-- Profissões regulamentadas e atividades vedadas ao MEI → false.
UPDATE codigos_nbs SET permitido_mei = false
WHERE codigo IN (
  '04010100', -- Medicina e biomedicina
  '04020100', -- Enfermagem
  '04030100', -- Fonoaudiologia
  '04040100', -- Psicologia, psicanálise
  '04050100', -- Fisioterapia
  '04060100', -- Nutrição
  '07010100', -- Engenharia, agronomia, arquitetura, geologia, urbanismo
  '25010100', -- Serviços veterinários
  '12010100', -- Ensino regular pré-escolar, fundamental, médio e superior
  '10010100', -- Agenciamento e corretagem de seguros
  '10020100', -- Agenciamento, corretagem e intermediação de câmbio
  '03010100', -- Serviços de informações financeiras
  '11010100'  -- Arrendamento mercantil (leasing)
);

-- Índice para a busca por descrição (trigram para ILIKE eficiente).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_codigos_nbs_descricao_trgm
  ON codigos_nbs USING gin (descricao gin_trgm_ops);
