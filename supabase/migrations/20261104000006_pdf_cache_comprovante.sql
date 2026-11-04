-- #276 — o PDF guardado (pdf_s3_key) era o comprovante próprio montado da DPS.
-- Agora o download entrega o DANFSE oficial do ADN ou o DANFSE no leiaute
-- oficial gerado do XML da NFS-e; só o PDF do ADN volta a ser guardado.
-- Sem limpar, o comprovante antigo continuaria sendo servido.
UPDATE notas_fiscais SET pdf_s3_key = NULL WHERE pdf_s3_key IS NOT NULL;
