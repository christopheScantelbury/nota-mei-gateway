/**
 * Cliente (tomador cadastrado) — modelo compartilhado entre routes,
 * páginas e componentes do dashboard.
 */
export interface Cliente {
  id:             string
  empresa_id:     string

  // Identidade
  tipo:           'PJ' | 'PF'
  documento:      string         // só dígitos
  razao_social:   string
  nome_fantasia:  string | null
  email:          string | null
  telefone:       string | null

  // Endereço (opcional — preenchido sob demanda)
  municipio_ibge: string | null
  uf:             string | null
  cep:            string | null
  logradouro:     string | null
  numero:         string | null
  complemento:    string | null
  bairro:         string | null

  // Fiscal
  inscricao_estadual:  string | null
  inscricao_municipal: string | null

  // Organização (Pro/Business)
  tags:           string[]
  observacoes:    string | null

  // Agregados em cache (mantidos por trigger)
  total_emitido_brl:   number
  total_notas:         number
  primeira_emissao_em: string | null
  ultima_emissao_em:   string | null

  ativo:          boolean
  arquivado_em:   string | null
  created_at:     string
  updated_at:     string
}

/** Item retornado pelo /api/clientes/autocomplete — payload minimal */
export interface ClienteAutocomplete {
  id:             string
  tipo:           'PJ' | 'PF'
  documento:      string
  razao_social:   string
  email:          string | null
  municipio_ibge: string | null
  total_notas:    number
  ultima_emissao_em: string | null
}

/** Campos editáveis via PATCH / criáveis via POST */
export interface ClienteInput {
  tipo:           'PJ' | 'PF'
  documento:      string
  razao_social:   string
  nome_fantasia?: string | null
  email?:         string | null
  telefone?:      string | null
  municipio_ibge?: string | null
  uf?:            string | null
  cep?:           string | null
  logradouro?:    string | null
  numero?:        string | null
  complemento?:   string | null
  bairro?:        string | null
  inscricao_estadual?:  string | null
  inscricao_municipal?: string | null
  tags?:          string[]
  observacoes?:   string | null
}
