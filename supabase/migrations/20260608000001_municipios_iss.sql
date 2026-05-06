-- ME-20: municipios_nfse + iss_aliquotas tables
-- Enables multi-municipality ISS rate lookup for NFS-e Nacional (ME/EPP path).

-- ── municipios_nfse ─────────────────────────────────────────────────────────
-- Tracks which IBGE municipalities are active on the NFS-e Nacional platform.
-- Updated monthly by the update_municipios job (cmd/jobs/update_municipios.go).
CREATE TABLE municipios_nfse (
    ibge        VARCHAR(7)   PRIMARY KEY,
    nome        VARCHAR(255) NOT NULL,
    uf          CHAR(2)      NOT NULL,
    ativo       BOOLEAN      DEFAULT true,
    data_adesao DATE,
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── iss_aliquotas ────────────────────────────────────────────────────────────
-- Per-municipality ISS rates, optionally scoped to a specific NBS code.
-- Lookup order: (ibge + codigo_nbs) → (ibge + NULL) → client-provided value.
--
-- aliquota constraint:
--   - 0.00  = isenção (tax-exempt — some municipalities grant ISS exemption for tech services)
--   - 2.00–5.00 = normal ISS range (LC 116/2003, Art. 8)
CREATE TABLE iss_aliquotas (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ibge         VARCHAR(7)   NOT NULL REFERENCES municipios_nfse(ibge),
    codigo_nbs   VARCHAR(20),                          -- NULL = municipality default
    aliquota     DECIMAL(5,2) NOT NULL
                              CHECK (aliquota = 0.00 OR aliquota BETWEEN 2.00 AND 5.00),
    vigencia_ini DATE         NOT NULL DEFAULT '2026-01-01',
    vigencia_fim DATE,                                 -- NULL = currently valid
    UNIQUE (ibge, codigo_nbs, vigencia_ini)
);

CREATE INDEX ON iss_aliquotas(ibge, codigo_nbs);
CREATE INDEX ON municipios_nfse(uf) WHERE ativo = true;

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE municipios_nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE iss_aliquotas   ENABLE ROW LEVEL SECURITY;

-- Both tables are publicly readable — no auth required for municipality list.
CREATE POLICY "municipios_public_read" ON municipios_nfse FOR SELECT USING (true);
CREATE POLICY "iss_aliquotas_public_read" ON iss_aliquotas FOR SELECT USING (true);

-- ── Seed: 10 priority municipalities ────────────────────────────────────────
INSERT INTO municipios_nfse (ibge, nome, uf, ativo, data_adesao) VALUES
    ('1302603', 'Manaus',         'AM', true, '2026-01-01'),
    ('3550308', 'São Paulo',      'SP', true, '2023-09-01'),
    ('3304557', 'Rio de Janeiro', 'RJ', true, '2023-09-01'),
    ('3106200', 'Belo Horizonte', 'MG', true, '2024-01-01'),
    ('4106902', 'Curitiba',       'PR', true, '2024-01-01'),
    ('4314902', 'Porto Alegre',   'RS', true, '2024-01-01'),
    ('2927408', 'Salvador',       'BA', true, '2024-06-01'),
    ('2304400', 'Fortaleza',      'CE', true, '2024-06-01'),
    ('2611606', 'Recife',         'PE', true, '2024-06-01'),
    ('5300108', 'Brasília',       'DF', true, '2023-09-01');

-- ── Seed: Manaus NBS-specific rates (source: nota.manaus.am.gov.br) ─────────
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota) VALUES
    ('1302603', NULL,           2.00), -- padrão Manaus
    ('1302603', '01.01.01.10', 2.00), -- desenvolvimento de software
    ('1302603', '01.01.01.20', 2.00), -- manutenção de software
    ('1302603', '01.01.02.10', 2.00), -- análise de sistemas
    ('1302603', '01.05.01.00', 2.00), -- suporte técnico
    ('1302603', '17.01.01.10', 2.00), -- consultoria em TI
    ('1302603', '17.01.02.10', 3.00), -- consultoria em gestão
    ('1302603', '01.07.01.10', 2.00); -- hospedagem/cloud

-- ── Seed: São Paulo default rate ─────────────────────────────────────────────
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota) VALUES
    ('3550308', NULL, 2.00); -- padrão SP (tech services)

-- ── Seed: remaining municipalities — generic default ─────────────────────────
-- These municipalities have no per-NBS mapping; clients must inform aliquota_iss
-- when the municipality has only a generic default (aliquotas_nbs_mapeadas=false).
INSERT INTO iss_aliquotas (ibge, codigo_nbs, aliquota)
SELECT ibge, NULL, 2.00
FROM municipios_nfse
WHERE ibge NOT IN ('1302603', '3550308');
