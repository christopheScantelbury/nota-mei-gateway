-- ============================================================
-- Fix data: ctrib_nac 140101 rejeitado pela Receita (E0310)
--
-- Contexto: a coluna codigos_nbs.ctrib_nac_valido foi marcada como
-- TRUE pra ctrib_nac '140101' no seed inicial, mas a Receita Federal
-- rejeita esse código com E0310 ("código de tributação nacional
-- informado não existe conforme a lista de serviços nacional").
--
-- Também: o CNAE 9511800 (Reparação de computadores) só mapeava pra
-- ctrib_nac 140101, deixando esses MEIs sem nenhuma opção válida.
-- Adicionamos alternativas válidas (TI/consultoria) já presentes no
-- seed e auto-permitidas pra MEI.
-- ============================================================

-- 1. Marca ctrib_nac 140101 como inválido (Receita rejeita)
UPDATE codigos_nbs
   SET ctrib_nac_valido = FALSE
 WHERE ctrib_nac = '140101';

-- 2. Adiciona ctribs alternativos válidos pra CNAEs de reparação
--    (9511800 = reparação computadores; 9512600 = reparação periféricos)
INSERT INTO cnae_ctribnac (cnae_codigo, ctrib_nac)
VALUES
  ('9511800', '010101'),  -- Desenvolvimento e produção de softwares sob encomenda
  ('9511800', '010401'),  -- Elaboração de programas de computadores
  ('9511800', '170101'),  -- Assessoria e consultoria em geral
  ('9512600', '010101'),
  ('9512600', '010401'),
  ('9512600', '170101')
ON CONFLICT (cnae_codigo, ctrib_nac) DO NOTHING;
