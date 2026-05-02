-- BIL-01: Seed dos planos do produto
-- Adiciona constraint UNIQUE(nome) necessária para o upsert idempotente.
-- stripe_price_id / stripe_product_id são preenchidos em STR-01 após criar os
-- produtos no Stripe Dashboard.

ALTER TABLE planos ADD CONSTRAINT planos_nome_unique UNIQUE (nome);

INSERT INTO planos (nome, emissoes_limite, preco_mensal_brl, preco_excedente_brl, stripe_price_id, stripe_product_id, ativo)
VALUES
  ('Trial',    20,    0.00,   NULL,   NULL, NULL, true),
  ('Starter',  50,    29.90,  1.5000, NULL, NULL, true),
  ('Basic',    200,   79.90,  0.9000, NULL, NULL, true),
  ('Pro',      500,   149.90, 0.6000, NULL, NULL, true),
  ('Business', 2000,  399.90, 0.4000, NULL, NULL, true)
ON CONFLICT (nome) DO UPDATE SET
  emissoes_limite     = EXCLUDED.emissoes_limite,
  preco_mensal_brl    = EXCLUDED.preco_mensal_brl,
  preco_excedente_brl = EXCLUDED.preco_excedente_brl,
  ativo               = EXCLUDED.ativo;
