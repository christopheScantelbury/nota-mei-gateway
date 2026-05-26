// Cliente mínimo para BrasilAPI — consulta de CNPJ (gratuito, sem auth).
// Doc: https://brasilapi.com.br/docs#tag/CNPJ

const TIMEOUT_MS = 5_000
const BASE = 'https://brasilapi.com.br/api/cnpj/v1'

export interface BrasilAPICNPJ {
  cnpj: string
  razao_social: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  cnaes_secundarios: Array<{ codigo: number; descricao: string }>
  opcao_pelo_mei: boolean | null
  descricao_situacao_cadastral: string
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
