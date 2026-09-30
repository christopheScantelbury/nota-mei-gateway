-- Idempotency-Key única POR EMPRESA (não global).
--
-- A constraint original (UNIQUE em idempotency_key) fazia duas empresas que
-- usassem a mesma chave (ex.: "pedido-1") colidirem: a segunda recebia erro.
-- A API agora busca a nota por (empresa_id, idempotency_key) e devolve a
-- existente em retries; este índice é o que garante isso no banco.
--
-- O nome do índice contém "idempotency": nota_repository.Create usa isso pra
-- identificar a violação 23505 e responder com replay em vez de 500.

ALTER TABLE notas_fiscais
  DROP CONSTRAINT IF EXISTS notas_fiscais_idempotency_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS notas_fiscais_empresa_idempotency_key_idx
  ON notas_fiscais (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
