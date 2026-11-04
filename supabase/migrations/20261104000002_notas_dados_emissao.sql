-- #272: guarda o pedido original da nota (serviço, tomador, competência) para
-- o dashboard pré-preencher "Corrigir e emitir novamente" / "Emitir outra igual".
-- Antes só existiam tomador_doc/tomador_nome/valor; discriminação, código do
-- serviço, e-mail e município do tomador ficavam só no XML (que, nas notas de
-- 03-04/11/2026, se perdeu com o S3 da AWS).
--
-- RLS: herdada da tabela notas_fiscais (empresa_own_notas) — sem mudança.
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS dados_emissao JSONB;

COMMENT ON COLUMN notas_fiscais.dados_emissao IS
  'Pedido original da emissão (servico, tomador, competencia, iss_retido) — usado para pré-preencher nova emissão no dashboard.';

-- #274: o envio automático ao tomador (auto_email_tomador) agora é usado por
-- emissões manuais e recorrências; o índice parcial cobre a fila do Dispatcher.
CREATE INDEX IF NOT EXISTS idx_notas_auto_email_fila
  ON notas_fiscais (updated_at)
  WHERE auto_email_tomador AND auto_email_enviado_em IS NULL AND status = 'AUTORIZADA';
