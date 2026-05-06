-- ME-EP4 (ME-31): Add tomador_tipo and motivo_cancelamento to notas_fiscais.
-- tomador_tipo: PRIVADO | ORGAO_PUBLICO — determines cancellation window (90 vs 365 days).
-- motivo_cancelamento: free-text reason provided by the empresa at cancellation time.

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS tomador_tipo        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS motivo_cancelamento VARCHAR(100);

COMMENT ON COLUMN notas_fiscais.tomador_tipo IS
  'PRIVADO or ORGAO_PUBLICO — governs cancellation window: 90 days for private, 365 for public bodies (ME-31)';

COMMENT ON COLUMN notas_fiscais.motivo_cancelamento IS
  'Optional free-text cancellation reason provided by the empresa (ME-31)';
