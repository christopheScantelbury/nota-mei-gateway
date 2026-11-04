-- #268/#270 — recorrência de empresa sem certificado A1 (ex.: perdido na saída
-- da AWS) não é erro do sistema: fica marcada como pendente, o dono é avisado
-- uma única vez por e-mail e a nota sai sozinha quando o A1 voltar.
ALTER TABLE nota_recorrencias
  ADD COLUMN IF NOT EXISTS pendente_certificado_desde TIMESTAMPTZ;
