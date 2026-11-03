-- Suporte com IA na 1ª linha + atendimento humano (2026-11-03)
--
-- O cliente conversa só pelo chat "Ajuda" do dashboard; a IA (Claude) responde
-- com ferramentas SOMENTE de leitura da própria empresa e escala para humano.
-- Nós atendemos pelo /admin/suporte. Toda escrita passa pelos route handlers
-- (service role) — o cliente só tem SELECT nos próprios chamados.
--
-- support_knowledge é a base de conhecimento VIVA do atendente: o que mudou,
-- bugs conhecidos, correções publicadas. Editável no /admin sem deploy.

-- ── Chamados ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id            UUID         REFERENCES empresas(id) ON DELETE SET NULL,
    user_id               UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status                VARCHAR(20)  NOT NULL DEFAULT 'ia'
                          CHECK (status IN ('ia', 'aguardando_humano', 'aguardando_cliente', 'resolvido')),
    prioridade            VARCHAR(10)  NOT NULL DEFAULT 'normal'
                          CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    assunto               VARCHAR(160),
    resumo                TEXT,                       -- resumo da IA ao escalar
    motivo_escalada       TEXT,
    assumido_por          UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Transcript bruto da API (MessageParam[]), SÓ POR ACRÉSCIMO: o Opus 5.5
    -- exige reenviar o histórico (com blocos de thinking) sem edição.
    ai_transcript         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    ai_input_tokens       INTEGER      NOT NULL DEFAULT 0,
    ai_output_tokens      INTEGER      NOT NULL DEFAULT 0,
    ai_cache_read_tokens  INTEGER      NOT NULL DEFAULT 0,
    ai_custo_usd          NUMERIC(10,4) NOT NULL DEFAULT 0,
    -- Trava contra duas respostas da IA em paralelo no mesmo chamado
    -- (intercalaria o transcript). Expira sozinha após 2 min.
    ia_processando_desde  TIMESTAMPTZ,
    ultima_mensagem_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ultima_mensagem_autor VARCHAR(12),
    resolvido_em          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_fila    ON support_tickets(status, ultima_mensagem_em DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user    ON support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_empresa ON support_tickets(empresa_id, created_at DESC);

-- ── Mensagens ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id      UUID         NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    -- interno = nota da equipe, NUNCA visível ao cliente
    autor          VARCHAR(12)  NOT NULL
                   CHECK (autor IN ('cliente', 'ia', 'atendente', 'interno', 'sistema')),
    autor_user_id  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    conteudo       TEXT         NOT NULL CHECK (length(conteudo) BETWEEN 1 AND 8000),
    anexo_path     TEXT,        -- caminho no bucket privado suporte-anexos
    metadata       JSONB,       -- ferramentas usadas, tokens, modelo
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id, created_at);
-- Cota diária por usuário/global (mensagens do cliente e respostas da IA)
CREATE INDEX IF NOT EXISTS idx_support_messages_autor_data ON support_messages(autor, created_at DESC);

-- ── Base de conhecimento do atendente ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_knowledge (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo          VARCHAR(200) NOT NULL,
    conteudo        TEXT         NOT NULL CHECK (length(conteudo) BETWEEN 1 AND 6000),
    categoria       VARCHAR(20)  NOT NULL DEFAULT 'faq'
                    CHECK (categoria IN ('correcao', 'limitacao', 'instabilidade', 'procedimento', 'faq')),
    ativo           BOOLEAN      NOT NULL DEFAULT true,
    ordem           INTEGER      NOT NULL DEFAULT 0,
    atualizado_por  UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE support_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_knowledge ENABLE ROW LEVEL SECURITY;

-- Cliente: lê só os próprios chamados e mensagens não internas. Sem INSERT/UPDATE
-- (as rotas usam service role depois de validar o dono).
CREATE POLICY "support_tickets_own_read" ON support_tickets
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "support_messages_own_read" ON support_messages
    FOR SELECT USING (
        autor <> 'interno'
        AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    );

-- Equipe
CREATE POLICY "support_tickets_admin_read"    ON support_tickets   FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "support_messages_admin_read"   ON support_messages  FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "support_knowledge_admin_read"  ON support_knowledge FOR SELECT USING (is_admin(auth.uid()));

-- ── Acréscimo atômico ao transcript da IA (+ custo) e liberação da trava ────
CREATE OR REPLACE FUNCTION support_append_transcript(
    p_ticket UUID, p_itens JSONB,
    p_input INTEGER, p_output INTEGER, p_cache_read INTEGER, p_custo NUMERIC
) RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
    UPDATE support_tickets
       SET ai_transcript        = ai_transcript || p_itens,
           ai_input_tokens      = ai_input_tokens + p_input,
           ai_output_tokens     = ai_output_tokens + p_output,
           ai_cache_read_tokens = ai_cache_read_tokens + p_cache_read,
           ai_custo_usd         = ai_custo_usd + p_custo,
           ia_processando_desde = NULL,
           updated_at           = NOW()
     WHERE id = p_ticket;
$$;
REVOKE ALL ON FUNCTION support_append_transcript(UUID, JSONB, INTEGER, INTEGER, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;

-- ── Anexos (bucket PRIVADO — prints podem conter dados fiscais) ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('suporte-anexos', 'suporte-anexos', false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE support_tickets IS
    'Chamados de suporte. status: ia (IA atendendo) → aguardando_humano → aguardando_cliente → resolvido.';
COMMENT ON TABLE support_knowledge IS
    'Base de conhecimento viva do atendente de IA. Atualizar a cada correção/deploy/incidente.';

-- ── Conhecimento inicial (docs/suporte/conhecimento-atendente.md) ───────────
INSERT INTO support_knowledge (titulo, categoria, ordem, conteudo) VALUES
(
  'Como falar com o cliente sobre falhas e rejeições',
  'procedimento', 1,
  'Quando uma rejeição ou falha já corrigida afetou o cliente, trate como uma instabilidade momentânea que já foi normalizada. Não diga que foi "erro nosso", "bug" ou "defeito do sistema", não culpe a Receita, o Stripe ou outro parceiro, e não cite códigos internos, commits ou detalhes técnicos da correção. Peça desculpas pelo transtorno e diga objetivamente o que o cliente deve fazer agora (em geral, emitir de novo).
Nunca prometa reembolso, desconto, crédito ou mudança de plano: isso é só com humano.'
),
(
  'Rejeição E0714 "Arquivo enviado com erro na assinatura" — corrigido em 03/11/2026',
  'correcao', 10,
  'Uso interno: notas cuja descrição do serviço tinha quebras de linha (ex.: dados bancários em várias linhas) ou aspas eram rejeitadas pela Receita com E0714, por uma falha no cálculo da assinatura digital do NotaFácil (não era o certificado do cliente). Corrigido em 03/11/2026 por volta das 17h50 (horário de Brasília).
Como orientar: diga que houve uma instabilidade momentânea, já normalizada. Quem teve E0714 até essa data pode emitir a nota novamente — pelo painel, "Corrigir e emitir novamente" ou uma nova emissão; pela API, com uma nova Idempotency-Key (reenviar a mesma chave devolve a rejeição antiga). Não precisa trocar o certificado nem mudar a descrição. Nota rejeitada não gera efeito fiscal. Se o cliente já emitiu a mesma nota pelo portal da Receita, avise para não emitir de novo (sairia em duplicidade).
Se acontecer E0714 depois de 03/11/2026: transferir para humano.'
),
(
  'Rejeição E0166 "regime de apuração dos tributos do SN" (ME/EPP do Simples) — corrigido em 03/11/2026',
  'correcao', 15,
  'Uso interno: toda nota de empresa ME/EPP optante do Simples Nacional era rejeitada com E0166 ("É obrigatório o preenchimento do campo de regime de apuração dos tributos do SN para o optante do Simples Nacional ME/EPP"), porque o NotaFácil não enviava esse campo. MEI não era afetado. Corrigido em 03/11/2026 às 18h08 (horário de Brasília); o NotaFácil agora informa que os tributos federais e o ISS são apurados pelo Simples Nacional.
Como orientar: diga que houve uma instabilidade momentânea, já normalizada, e que pode emitir novamente (pelo painel, "Corrigir e emitir novamente" ou uma nova emissão; pela API, com nova Idempotency-Key). O cliente não precisa mudar nada no cadastro.
Transferir para humano se: acontecer E0166 depois de 03/11/2026 18h08, ou se a empresa disser que ultrapassou o sublimite do Simples / recolhe ISS ou tributos federais fora do Simples (o NotaFácil ainda não tem essa opção).'
),
(
  'Assinatura paga aparecendo como Trial — corrigido em 03/11/2026',
  'correcao', 20,
  'O pagamento no cartão era aprovado, mas o plano não era atualizado (continuava Trial e o portal de cobrança não abria). Corrigido em 03/11/2026; assinaturas pagas antes disso já foram atualizadas.
Como orientar: se o cliente pagou e ainda vê Trial, peça para recarregar a página ou sair e entrar de novo; se continuar, transferir para humano com prioridade alta (envolve cobrança). Nunca pedir para pagar de novo.'
),
(
  'Cota do mês consumida por tentativas do período de teste',
  'limitacao', 25,
  'No período de teste toda tentativa de emissão conta na cota, inclusive as rejeitadas; no plano pago só contam as notas autorizadas. Hoje as tentativas feitas no teste continuam contando depois que o cliente assina, no mesmo mês.
Como orientar: se o cliente disser que a cota aparece consumida sem notas autorizadas, ou que bateu o limite por causa de rejeições, transferir para humano (a equipe ajusta o contador). Não prometer créditos extras.'
),
(
  'Nota de produto (NF-e / NFC-e) não é emitida',
  'limitacao', 30,
  'O NotaFácil emite apenas NFS-e (nota de serviço) pela NFS-e Nacional. NF-e e NFC-e (venda de mercadoria) não são emitidas. O tema está em avaliação, sem prazo — não prometer data.'
),
(
  'PDF oficial da nota (DANFSE) instável na Receita',
  'instabilidade', 40,
  'O serviço da Receita que gera o PDF oficial (ADN) está instável. Quando indisponível, o link do PDF redireciona para a consulta pública da nota no portal nfse.gov.br pela chave de acesso — isso é esperado e a nota continua válida.'
);
