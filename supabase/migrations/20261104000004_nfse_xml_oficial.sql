-- #275 — "Download XML" passa a entregar o XML oficial da NFS-e (raiz <NFSe>,
-- gerado pela Receita), não a DPS que enviamos.
--
-- nfse_xml_key          → objeto no storage (notas/{dono}/{nota}/nfse.xml)
-- nfse_xml_tentativa_em → última tentativa sem sucesso do backfill (busca em
--                         GET /SefinNacional/nfse/{chave}); evita martelar a
--                         Receita com notas cujo certificado não existe mais.
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS nfse_xml_key TEXT,
  ADD COLUMN IF NOT EXISTS nfse_xml_tentativa_em TIMESTAMPTZ;

-- xml_retorno recebia o Id da NFS-e ("NFS" + chave, 53 caracteres), não um XML.
UPDATE notas_fiscais
SET xml_retorno = NULL
WHERE xml_retorno IS NOT NULL
  AND xml_retorno NOT LIKE '<%';

CREATE INDEX IF NOT EXISTS idx_notas_nfse_xml_pendente
  ON notas_fiscais (nfse_xml_tentativa_em NULLS FIRST)
  WHERE nfse_xml_key IS NULL AND status IN ('AUTORIZADA', 'CANCELADA');
