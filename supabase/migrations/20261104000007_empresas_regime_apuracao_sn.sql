-- #279 — ME/EPP optante do Simples Nacional: regime de apuração dos tributos
-- (regApTribSN da DPS). Antes era fixo em 1, o que impedia emitir certo para
-- empresa acima do sublimite.
--   1 = tributos federais e municipal pelo Simples Nacional (padrão)
--   2 = federais pelo SN e ISSQN fora do SN (sublimite estadual/municipal)
--   3 = federais e municipal fora do SN
-- NULL = 1.
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS regime_apuracao_sn SMALLINT
  CHECK (regime_apuracao_sn IS NULL OR regime_apuracao_sn IN (1, 2, 3));
