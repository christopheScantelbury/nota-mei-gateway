-- seed_municipios.sql — manual expansion of municipios_nfse + iss_aliquotas
-- Run after supabase db push when adding municipalities without a new migration.
-- Usage: psql $DATABASE_URL -f supabase/seed_municipios.sql
--
-- Municipalities are marked as active on NFS-e Nacional.
-- NBS-specific rates override the generic default for each municipality.
--
-- Legend:
--   ✅ Manaus    — full NBS mapping (01.01.xx, 17.01.xx, 01.07.xx)
--   ✅ São Paulo — default only (clients should inform aliquota_iss per NBS)
--   ✅ Others    — generic 2% default (clients must inform aliquota_iss if different)
--
-- Documented municipalities with full NBS mapping:
--   Manaus (AM) — aliquotas_nbs_mapeadas = true
--
-- Documented municipalities with default-only mapping:
--   São Paulo (SP), Rio de Janeiro (RJ), Belo Horizonte (MG),
--   Curitiba (PR), Porto Alegre (RS), Salvador (BA),
--   Fortaleza (CE), Recife (PE), Brasília (DF)

-- Idempotent upsert — safe to run multiple times.
INSERT INTO municipios_nfse (ibge, nome, uf, ativo, data_adesao, updated_at)
VALUES
    ('1302603', 'Manaus',         'AM', true, '2026-01-01', NOW()),
    ('3550308', 'São Paulo',      'SP', true, '2023-09-01', NOW()),
    ('3304557', 'Rio de Janeiro', 'RJ', true, '2023-09-01', NOW()),
    ('3106200', 'Belo Horizonte', 'MG', true, '2024-01-01', NOW()),
    ('4106902', 'Curitiba',       'PR', true, '2024-01-01', NOW()),
    ('4314902', 'Porto Alegre',   'RS', true, '2024-01-01', NOW()),
    ('2927408', 'Salvador',       'BA', true, '2024-06-01', NOW()),
    ('2304400', 'Fortaleza',      'CE', true, '2024-06-01', NOW()),
    ('2611606', 'Recife',         'PE', true, '2024-06-01', NOW()),
    ('5300108', 'Brasília',       'DF', true, '2023-09-01', NOW())
ON CONFLICT (ibge) DO UPDATE
    SET nome        = EXCLUDED.nome,
        uf          = EXCLUDED.uf,
        ativo       = EXCLUDED.ativo,
        data_adesao = EXCLUDED.data_adesao,
        updated_at  = NOW();

-- Manaus NBS-specific rates (fonte: nota.manaus.am.gov.br)
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota, vigencia_ini)
VALUES
    ('1302603', NULL,           2.00, '2026-01-01'),
    ('1302603', '01.01.01.10', 2.00, '2026-01-01'),
    ('1302603', '01.01.01.20', 2.00, '2026-01-01'),
    ('1302603', '01.01.02.10', 2.00, '2026-01-01'),
    ('1302603', '01.05.01.00', 2.00, '2026-01-01'),
    ('1302603', '17.01.01.10', 2.00, '2026-01-01'),
    ('1302603', '17.01.02.10', 3.00, '2026-01-01'),
    ('1302603', '01.07.01.10', 2.00, '2026-01-01')
ON CONFLICT (ibge, codigo_nbs, vigencia_ini) DO UPDATE
    SET aliquota = EXCLUDED.aliquota;

-- São Paulo default
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota, vigencia_ini)
VALUES ('3550308', NULL, 2.00, '2023-09-01')
ON CONFLICT (ibge, codigo_nbs, vigencia_ini) DO UPDATE
    SET aliquota = EXCLUDED.aliquota;

-- Remaining municipalities: generic 2% default
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota, vigencia_ini)
SELECT m.ibge, NULL, 2.00, m.data_adesao
FROM municipios_nfse m
WHERE m.ibge NOT IN ('1302603', '3550308')
ON CONFLICT (ibge, codigo_nbs, vigencia_ini) DO NOTHING;
