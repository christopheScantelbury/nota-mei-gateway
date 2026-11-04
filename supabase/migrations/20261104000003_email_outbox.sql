-- Fila de e-mails transacionais da API (email_outbox).
--
-- Todo e-mail sai daqui: gravado antes do envio, reenviado com espera
-- crescente se o provedor falhar, e reenviável pelo admin (/admin/emails).
-- Provedores, em ordem: Brevo API HTTP → Brevo SMTP (fallback).
--
-- O conteúdo (destinatário, assunto, HTML) vai CIFRADO em `conteudo`
-- (AES-256-GCM, chave derivada da CERT_MASTER_KEY): o e-mail de boas-vindas
-- leva a chave de API, que nunca pode ficar em claro no banco.
--
-- RLS ligado e sem políticas: só a API (service role) acessa.
CREATE TABLE IF NOT EXISTS email_outbox (
  id                    UUID PRIMARY KEY,
  tipo                  VARCHAR(40)  NOT NULL,
  destino_dominio       VARCHAR(255),          -- só o domínio, para diagnóstico
  conteudo              BYTEA        NOT NULL, -- nonce || ciphertext || tag
  status                VARCHAR(12)  NOT NULL DEFAULT 'pendente',
  tentativas            INTEGER      NOT NULL DEFAULT 0,
  proxima_tentativa_em  TIMESTAMPTZ,
  ultimo_erro           TEXT,
  provedor              VARCHAR(20),
  message_id            VARCHAR(255),
  nota_id               UUID REFERENCES notas_fiscais(id) ON DELETE SET NULL,
  empresa_id            UUID REFERENCES empresas(id)      ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  enviado_em            TIMESTAMPTZ,
  CONSTRAINT email_outbox_status CHECK (status IN ('pendente', 'enviado', 'falhou'))
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_fila
  ON email_outbox (proxima_tentativa_em) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_email_outbox_recentes
  ON email_outbox (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_nota
  ON email_outbox (nota_id) WHERE nota_id IS NOT NULL;

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON email_outbox FROM anon, authenticated;

COMMENT ON TABLE email_outbox IS
  'Fila de e-mails da API com reenvio automático. Conteúdo cifrado (AES-256-GCM, CERT_MASTER_KEY).';
