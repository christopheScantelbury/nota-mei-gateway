-- 20260722000001_planos_descricao_sem_numero.sql
--
-- Corrige a contradição de limites nos cards ME de /me (tráfego pago Google Ads).
--
-- SINTOMA (produção, 2026-07-22):
--   ME Start    → desc "Emissão de até 10 NFS-e por mês"  vs  limite 30 notas/mês
--   ME Pro      → desc "Emissão de até 70 NFS-e por mês"  vs  limite 100 notas/mês
--   ME Business → desc "até 300"                          vs  limite 300  (ok)
--
-- CAUSA RAIZ: o número de notas vivia em DOIS campos da mesma linha —
-- `emissoes_limite` (renderizado como "N notas/mês") e `descricao_curta`
-- (renderizada logo abaixo do nome do plano). `20260622000002_planos_admin.sql`
-- gravou as descrições com o número da época (10 / 50), e depois o limite foi
-- alterado sem que a descrição acompanhasse:
--   · ME Pro:   50 → 100 em `20260622000006_planos_manaus_gateway.sql`
--               (desc ficou defasada; alguém depois editou pra "70" via /admin,
--                número que não corresponde a nenhum estado do plano)
--   · ME Start: 10 → 30 editado via /admin/planos (o limite 30 é o correto —
--               R$59,99/30 = R$2,00/nota, que é a base da escada de preço
--               documentada na migration Manaus, e é o que /precos já anuncia
--               publicamente e o que o BillingGuard efetivamente libera)
--
-- CORREÇÃO: `descricao_curta` deixa de conter número. O número passa a existir
-- em UM lugar só (`emissoes_limite`), então descrição e limite não têm mais
-- como divergir. A descrição vira posicionamento (pra quem é o plano), que é o
-- que ajuda o visitante a se autoclassificar — o número já aparece logo abaixo.
--
-- Guard complementar em `apps/web/app/admin/api/planos/[id]/route.ts`: o PATCH
-- do /admin/planos passa a rejeitar descrição com "até N notas" que contradiga
-- `emissoes_limite`.
--
-- Escopo: apenas planos tipo_empresa='ME' (cards da /me + card âncora da home).
-- Os planos MEI seguem com o padrão numérico — hoje batem com o limite, mas
-- carregam o mesmo risco de drift (ver Avulso MEI, desc "R$ 2,99" vs preço
-- R$ 5,99 em `preco_excedente_brl`, tratado à parte).
--
-- Não toca em preço, limite nem stripe_price_id — só copy.
-- A descrição do produto no Stripe só reflete isto após um resync
-- (/admin/planos → Resync, ou PATCH que altere a descrição).

BEGIN;

UPDATE planos SET descricao_curta = 'Pra experimentar sem cadastrar cartão.'
WHERE nome = 'Trial ME' AND tipo_empresa = 'ME';

UPDATE planos SET descricao_curta = 'Para Microempresa começando com NFS-e Nacional.'
WHERE nome = 'ME Start' AND tipo_empresa = 'ME';

UPDATE planos SET descricao_curta = 'Para ME com fluxo regular e multi-cliente.'
WHERE nome = 'ME Pro' AND tipo_empresa = 'ME';

UPDATE planos SET descricao_curta = 'Para ME/EPP estabelecidas com alta emissão.'
WHERE nome = 'ME Business' AND tipo_empresa = 'ME';

COMMENT ON COLUMN planos.descricao_curta IS
    'Descrição curta exibida no card do plano (landing + /admin) e espelhada na '
    'descrição do produto no Stripe. NÃO repetir aqui o número de notas — ele '
    'vem de emissoes_limite e é renderizado na linha "N notas/mês". Duplicar o '
    'número foi a causa da contradição corrigida em 20260722000001.';

COMMIT;
