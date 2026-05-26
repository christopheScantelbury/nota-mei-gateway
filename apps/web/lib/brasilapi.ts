// Cliente mínimo para BrasilAPI — consulta de CNPJ (gratuito, sem auth).
// Doc: https://brasilapi.com.br/docs#tag/CNPJ

const TIMEOUT_MS = 5_000
const BASE = 'https://brasilapi.com.br/api/cnpj/v1'

export interface BrasilAPICNPJ {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  email?: string
  ddd_telefone_1?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigo_municipio_ibge?: number | string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>
  opcao_pelo_mei: boolean | null
  descricao_situacao_cadastral: string
}

/**
 * Dados de CNPJ normalizados pra preenchimento do formulário de cliente.
 * Diferente de BrasilAPICNPJ que devolve o payload bruto, esse aqui devolve
 * tudo já string-friendly e com municipio_ibge no formato 7-dígitos esperado
 * pela NFS-e (ex.: "3550308" pra São Paulo capital).
 */
export interface CNPJClienteData {
  razao_social:   string
  nome_fantasia:  string | null
  email:          string | null
  telefone:       string | null
  cep:            string | null
  logradouro:     string | null
  numero:         string | null
  complemento:    string | null
  bairro:         string | null
  municipio:      string | null
  uf:             string | null
  municipio_ibge: string | null
}

/** Consulta CNPJ e devolve os campos prontos pra preencher o form de cliente. */
export async function fetchCNPJCliente(cnpj: string): Promise<CNPJClienteData | null> {
  const payload = await fetchCNPJ(cnpj)
  if (!payload) return null

  return {
    razao_social:   payload.razao_social ?? '',
    nome_fantasia:  payload.nome_fantasia || null,
    email:          payload.email || null,
    telefone:       payload.ddd_telefone_1 || null,
    cep:            payload.cep || null,
    logradouro:     payload.logradouro || null,
    numero:         payload.numero || null,
    complemento:    payload.complemento || null,
    bairro:         payload.bairro || null,
    municipio:      payload.municipio || null,
    uf:             payload.uf || null,
    municipio_ibge: payload.codigo_municipio_ibge
      ? String(payload.codigo_municipio_ibge).padStart(7, '0')
      : null,
  }
}

/**
 * Consulta os dados públicos de um CNPJ na BrasilAPI.
 * Retorna null em qualquer falha (timeout, 4xx, 5xx) — não-bloqueante.
 */
export async function fetchCNPJ(cnpj: string): Promise<BrasilAPICNPJ | null> {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return null

  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/${digits}`, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as BrasilAPICNPJ
  } catch {
    return null
  } finally {
    clearTimeout(tid)
  }
}

/**
 * Extrai os CNAEs (fiscal + secundários) e devolve como array de strings de 7
 * dígitos sem ponto-hífen (formato usado em `empresas.cnaes` e `cnae_ctribnac`).
 */
export function extractCNAEs(payload: BrasilAPICNPJ): string[] {
  const all = new Set<string>()
  if (payload.cnae_fiscal) all.add(String(payload.cnae_fiscal).padStart(7, '0'))
  for (const c of payload.cnaes_secundarios ?? []) {
    if (c.codigo) all.add(String(c.codigo).padStart(7, '0'))
  }
  return Array.from(all)
}
