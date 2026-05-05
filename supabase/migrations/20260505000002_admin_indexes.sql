-- Migration: índices para queries do painel admin
-- Criado em: 2026-05-05

-- Índice para listagem de notas com JOIN em meis (admin/notas)
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_created_at_desc
  ON notas_fiscais (created_at DESC);

-- Índice composto para uso do mês (admin/usuarios + billing page)
CREATE INDEX IF NOT EXISTS idx_emissoes_mensais_competencia_mei
  ON emissoes_mensais (competencia, mei_id);

-- Índice para busca de notas por tomador (admin search)
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_tomador_nome
  ON notas_fiscais USING gin (to_tsvector('portuguese', coalesce(tomador_nome, '')));

-- Índice para contagem rápida de notas hoje (admin stats)
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_created_at_btree
  ON notas_fiscais (created_at);

-- Índice para query de notas autorizadas (admin stats)
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_status_autorizada
  ON notas_fiscais (status)
  WHERE status = 'AUTORIZADA';
