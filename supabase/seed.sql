-- Seed: planos do produto
-- stripe_price_id será preenchido após STR-01

INSERT INTO planos (nome, emissoes_limite, preco_mensal_brl, preco_excedente_brl) VALUES
  ('Trial',    20,    0.00,   NULL),
  ('Starter',  50,    29.90,  1.50),
  ('Basic',    200,   79.90,  0.90),
  ('Pro',      500,   149.90, 0.60),
  ('Business', 2000,  399.90, 0.40);
