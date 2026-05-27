-- ============================================================
-- Refinamento de nota_recorrencias (agora "Automações")
--
-- 1. Adiciona empresa_id (FK em empresas) — permite RLS unificada
--    pra MEI legacy e ME/EPP. mei_id continua pra compatibilidade.
-- 2. Adiciona campos de auto-email do tomador (opt-in por automação).
-- 3. RLS atualizada usando empresa_id.
-- 4. Plan gate de Business → Starter passa pra UI; banco aceita qualquer
--    automação criada (controle visual).
-- ============================================================

-- ─── 1. empresa_id ─────────────────────────────────────────────
ALTER TABLE nota_recorrencias
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;

-- Backfill: mei_id e empresa_id são o mesmo UUID pra MEI legacy
-- (criados via RegisterMEI com empresas.id = meis.id = auth.uid()).
UPDATE nota_recorrencias
   SET empresa_id = mei_id
 WHERE empresa_id IS NULL AND mei_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nota_recorrencias_empresa
  ON nota_recorrencias(empresa_id) WHERE ativo = true;

-- ─── 2. Auto-email ─────────────────────────────────────────────
ALTER TABLE nota_recorrencias
  ADD COLUMN IF NOT EXISTS enviar_email_tomador BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_tomador        VARCHAR(255);

COMMENT ON COLUMN nota_recorrencias.enviar_email_tomador IS
  'Opt-in: ao emitir a nota recorrente, envia automaticamente cópia por email pro tomador (e cópia oculta pro emissor).';
COMMENT ON COLUMN nota_recorrencias.email_tomador IS
  'Endereço pra onde enviar a nota. Default: campo email do tomador no JSONB.';

-- ─── 3. RLS atualizada ────────────────────────────────────────
DROP POLICY IF EXISTS "mei_own_recorrencias" ON nota_recorrencias;

CREATE POLICY "empresa_own_recorrencias" ON nota_recorrencias
  FOR ALL USING (
    empresa_id IN (SELECT id FROM empresas WHERE user_id = auth.uid())
    -- fallback pra registros legacy onde só mei_id existe e === auth.uid()
    OR (empresa_id IS NULL AND mei_id = auth.uid())
  );

-- ─── 4. Carrega flag de auto-email pra notas_fiscais ────────────
-- Permite que o poller (que processa transições PROCESSANDO → AUTORIZADA)
-- saiba se deve disparar o email automaticamente quando a nota for aceita
-- pela Receita.
ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS auto_email_tomador BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_email_destino VARCHAR(255),
  ADD COLUMN IF NOT EXISTS auto_email_enviado_em TIMESTAMPTZ;

COMMENT ON COLUMN notas_fiscais.auto_email_tomador IS
  'TRUE quando esta nota foi emitida por uma automação com opt-in de email. Poller envia email após autorização.';
COMMENT ON COLUMN notas_fiscais.auto_email_destino IS
  'Endereço pra onde enviar. Snapshot do email_tomador da recorrência na hora da emissão.';
COMMENT ON COLUMN notas_fiscais.auto_email_enviado_em IS
  'Timestamp do envio. NULL = ainda não enviado. Idempotência: poller só envia se NULL.';

CREATE INDEX IF NOT EXISTS idx_notas_auto_email_pending
  ON notas_fiscais(auto_email_tomador, status)
  WHERE auto_email_tomador = TRUE AND status = 'AUTORIZADA' AND auto_email_enviado_em IS NULL;
