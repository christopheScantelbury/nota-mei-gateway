-- #296 — Reforma tributária (IBS/CBS): padrões por empresa para o grupo
-- <IBSCBS> da DPS. Todas as colunas são anuláveis; NULL = não configurado, e
-- a DPS dessa empresa continua saindo sem o grupo. O envio depende desta
-- configuração, não do regime tributário.
--
-- Classificação enviada na DPS v1.01 (TCRTCInfoIBSCBS):
--   ibscbs_cst_padrao        CST do IBS/CBS            — 3 dígitos (TSRTCCodSitTrib)
--   ibscbs_cclasstrib_padrao cClassTrib                — 6 dígitos (TSRTCCodClassTrib)
--   ibscbs_cindop_padrao     cIndOp, indicador da operação — 6 dígitos (TSRTCCodIndOp)
-- As três andam juntas: cIndOp é obrigatório no XSD sempre que o grupo é
-- enviado, então configuração parcial não gera um grupo válido.
--
-- Simples Nacional — leiaute da Nota Técnica SE/CGNFS-e nº 009 (Anexo VI
-- V1.04.01). Guardadas aqui, mas AINDA NÃO enviadas na DPS: o XSD desse
-- leiaute não está no repositório.
--   ibscbs_regime_apuracao_sn  regApIBSCBSSN:
--       1 = IBS e CBS apurados pelo Simples Nacional
--       2 = CBS pelo Simples e IBS no regime regular
--       3 = IBS e CBS no regime regular
--   ibscbs_catv_sn             cAtvSN: código da atividade no Simples. O domínio
--       exato (levantado como 7 a 14, e 90) vem do XSD novo; até lá o CHECK só
--       limita a 1–99.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS ibscbs_regime_apuracao_sn SMALLINT
    CHECK (ibscbs_regime_apuracao_sn IS NULL OR ibscbs_regime_apuracao_sn IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS ibscbs_catv_sn SMALLINT
    CHECK (ibscbs_catv_sn IS NULL OR ibscbs_catv_sn BETWEEN 1 AND 99),
  ADD COLUMN IF NOT EXISTS ibscbs_cst_padrao VARCHAR(3)
    CHECK (ibscbs_cst_padrao IS NULL OR ibscbs_cst_padrao ~ '^[0-9]{3}$'),
  ADD COLUMN IF NOT EXISTS ibscbs_cclasstrib_padrao VARCHAR(6)
    CHECK (ibscbs_cclasstrib_padrao IS NULL OR ibscbs_cclasstrib_padrao ~ '^[0-9]{6}$'),
  ADD COLUMN IF NOT EXISTS ibscbs_cindop_padrao VARCHAR(6)
    CHECK (ibscbs_cindop_padrao IS NULL OR ibscbs_cindop_padrao ~ '^[0-9]{6}$');

-- Classificação é tudo ou nada (CST + cClassTrib + cIndOp).
ALTER TABLE empresas DROP CONSTRAINT IF EXISTS empresas_ibscbs_classificacao_completa;
ALTER TABLE empresas
  ADD CONSTRAINT empresas_ibscbs_classificacao_completa
  CHECK (num_nonnulls(ibscbs_cst_padrao, ibscbs_cclasstrib_padrao, ibscbs_cindop_padrao) IN (0, 3));

COMMENT ON COLUMN empresas.ibscbs_regime_apuracao_sn IS 'regApIBSCBSSN (NT 009): 1=IBS/CBS pelo SN, 2=CBS pelo SN e IBS regular, 3=ambos regular. Ainda não enviado na DPS v1.01.';
COMMENT ON COLUMN empresas.ibscbs_catv_sn IS 'cAtvSN (NT 009): código da atividade no Simples Nacional. Ainda não enviado na DPS v1.01.';
COMMENT ON COLUMN empresas.ibscbs_cst_padrao IS 'CST padrão do IBS/CBS (3 dígitos) para o grupo IBSCBS da DPS.';
COMMENT ON COLUMN empresas.ibscbs_cclasstrib_padrao IS 'cClassTrib padrão do IBS/CBS (6 dígitos) para o grupo IBSCBS da DPS.';
COMMENT ON COLUMN empresas.ibscbs_cindop_padrao IS 'cIndOp padrão (6 dígitos, código indicador de operação) para o grupo IBSCBS da DPS.';
