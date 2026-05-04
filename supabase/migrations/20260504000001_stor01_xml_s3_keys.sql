-- STOR-01: Arquivamento fiscal 5 anos em AWS S3
-- Adiciona colunas de referência S3 para XMLs e PDFs das notas fiscais.
-- Os dados binários deixam de ser armazenados no PostgreSQL (TEXT), reduzindo
-- o tamanho da tabela e o custo de backup/vacuum.
--
-- Estratégia de migração:
--   1. Adiciona xml_s3_key e pdf_s3_key como colunas NULLABLE.
--   2. Mantém xml_enviado, xml_retorno e pdf_path para backward-compat
--      com notas antigas (o handler lê ambos e prefere as chaves S3).
--   3. Após backfill completo do histórico (tarefa separada), as colunas
--      de texto poderão ser dropped em uma migração futura.

ALTER TABLE notas_fiscais
    ADD COLUMN IF NOT EXISTS xml_s3_key TEXT,    -- S3 key do XML da nota (RPS enviado ou NFS-e retorno)
    ADD COLUMN IF NOT EXISTS pdf_s3_key TEXT;    -- S3 key do PDF gerado

-- Índice parcial para auditoria: identifica notas que ainda não tiveram
-- o XML migrado para S3 (útil para script de backfill).
CREATE INDEX IF NOT EXISTS idx_notas_sem_s3
    ON notas_fiscais (created_at)
    WHERE xml_s3_key IS NULL AND xml_enviado IS NOT NULL;

COMMENT ON COLUMN notas_fiscais.xml_s3_key IS
    'Chave S3 do XML da nota fiscal. Aponta para o RPS assinado (rps.xml) '
    'quando status = PROCESSANDO, ou para o NFS-e retorno (nfse.xml) quando '
    'status = AUTORIZADA. NULL para notas anteriores ao STOR-01 (2026-05-04).';

COMMENT ON COLUMN notas_fiscais.pdf_s3_key IS
    'Chave S3 do PDF gerado para a nota. NULL enquanto o PDF ainda não foi gerado '
    'ou para notas anteriores ao STOR-01 (2026-05-04).';
