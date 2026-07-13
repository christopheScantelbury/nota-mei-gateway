-- 20260622000006_planos_manaus_gateway.sql
--
-- Pacote de ajustes derivado do plano "NotaFácil — Plano de Ajuste para
-- Campanha (Manaus)", 2026-06-22.
--
-- 1. Permite tipo_empresa='API' em `planos` (novo segmento: Gateway / dev).
-- 2. Ajusta ME Pro de 50 notas/R$149,90/R$0,60 para 40 notas/R$129,90/R$0,50,
--    seguindo a tabela canônica 2.2 do doc.
-- 3. Cria 3 SKUs do Gateway (Starter / Pro / Scale) com excedentes blindados
--    contra arbitragem interna (sempre ≥ custo unitário do plano ME equivalente
--    e ≤ avulso PAYG R$0,89).
--
-- stripe_price_id e stripe_product_id ficam NULL aqui — serão preenchidos
-- pelo script `scripts/stripe-provision-gateway.mjs` que provisiona no Stripe
-- LIVE e devolve os IDs.
--
-- Pre-launch (sem assinantes) — ajuste de ME Pro não requer migração de
-- subscriptions Stripe; só re-link de stripe_price_id após provisão.

BEGIN;

-- ── 1. tipo_empresa CHECK ────────────────────────────────────────────────────
ALTER TABLE planos
    DROP CONSTRAINT IF EXISTS planos_tipo_empresa_check;

ALTER TABLE planos
    ADD CONSTRAINT planos_tipo_empresa_check
    CHECK (tipo_empresa IN ('MEI', 'ME', 'EPP', 'API', 'ALL'));

COMMENT ON COLUMN planos.tipo_empresa IS
    'Tipo societário alvo: MEI | ME | EPP | API (Gateway/dev) | ALL. NULL = legado MEI.';

-- ── 2. ME Pro: 50/R$149,90 → 100 notas/R$129,90/R$0,50 ───────────────────────
-- 2026-06-25: ajustado pra 100 notas (era 40 no plano Manaus original, mas
-- 40 notas por R$129,90 saía MAIS caro que ME Start + excedente — escada de
-- preço furada). 100 notas dá R$1,30/nota, entre Start (R$2,00) e Business
-- (R$1,00). Stripe price price_1TsmE8QkYQoRUOWmFtDfNKsz (R$129,90/mês)
-- provisionado direto na Stripe LIVE em 2026-06-25.
UPDATE planos
SET
    emissoes_limite     = 100,
    preco_mensal_brl    = 129.90,
    preco_excedente_brl = 0.50,
    stripe_price_id     = 'price_1TsmE8QkYQoRUOWmFtDfNKsz'
WHERE nome = 'ME Pro'
  AND tipo_empresa = 'ME';

-- ── 3. Gateway tiers (Starter / Pro / Scale) — ativo=false ──────────────────
-- 2026-06-25: criados INATIVOS. Decisão pós-launch: Gateway é pay-per-use
-- (Avulso R$0,89/nota); os tiers mensais ficam dormentes até haver demanda.
-- stripe_price_id nunca provisionado (não assináveis por enquanto).
-- Posicionamento:
--   PAYG (Avulso) R$0,89/nota fica como entrada (já existe via Avulso MEI ou
--   componente PricingToggleGateway). Os tiers abaixo são franquias com
--   excedentes blindados — sempre ≤ R$0,89 (não compete com PAYG) e custo
--   unitário ≥ custo unitário ME equivalente (não canibaliza painel humano).

INSERT INTO planos (
    nome,
    tipo_empresa,
    emissoes_limite,
    preco_mensal_brl,
    preco_excedente_brl,
    descricao_curta,
    destaque,
    ordem_exibicao,
    ativo,
    stripe_sync_error
) VALUES
    (
        'Gateway Starter', 'API', 50, 49.00, 0.75,
        'Para devs com volume previsível pequeno (50–80 notas/mês). Webhooks, SDKs e sandbox inclusos.',
        false, 100,
        false, 'pending-stripe-provision'
    ),
    (
        'Gateway Pro', 'API', 250, 149.00, 0.45,
        'Volume médio (250–700 notas/mês). Webhooks HMAC com retry, logs detalhados, suporte prioritário.',
        true, 101,
        false, 'pending-stripe-provision'
    ),
    (
        'Gateway Scale', 'API', 1000, 399.00, 0.30,
        'Volume alto (1k–3k notas/mês). SLA 99.9%, múltiplas chaves de produção, observabilidade dedicada.',
        false, 102,
        false, 'pending-stripe-provision'
    )
ON CONFLICT DO NOTHING;

COMMIT;
