import { codigoIBGE } from '@/lib/municipios'

/**
 * Consulta de CEP com fallback (#280): ViaCEP → BrasilAPI.
 *
 * Diferencia "CEP não existe" de "provedor fora do ar": antes qualquer falha
 * do ViaCEP (429/5xx) virava "CEP não encontrado" e o cliente achava que o
 * CEP estava errado.
 */
export interface CepResult {
  localidade: string
  uf: string
  ibge: string // código IBGE de 7 dígitos
  logradouro?: string
  bairro?: string
  complemento?: string
}

export type ConsultaCep =
  | { tipo: 'ok'; dados: CepResult; provedor: 'viacep' | 'brasilapi' }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'indisponivel' }

type Fetch = typeof fetch
type Resultado = ConsultaCep | { tipo: 'falhou' }

async function getJSON(f: Fetch, url: string, timeoutMs: number): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await f(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } })
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* corpo não-JSON */
    }
    return { status: res.status, body }
  } catch {
    return null // timeout / rede
  }
}

interface ViaCepRaw {
  erro?: boolean | string
  localidade?: string
  uf?: string
  ibge?: string
  logradouro?: string
  bairro?: string
  complemento?: string
}

async function viaCep(f: Fetch, cep: string): Promise<Resultado> {
  const r = await getJSON(f, `https://viacep.com.br/ws/${cep}/json/`, 5_000)
  if (!r || r.status >= 500 || r.status === 429) return { tipo: 'falhou' }
  const d = (r.body ?? {}) as ViaCepRaw
  if (r.status === 200 && (d.erro === true || d.erro === 'true')) return { tipo: 'nao_encontrado' }
  if (r.status !== 200 || !d.localidade || !d.ibge) return { tipo: 'falhou' }
  return {
    tipo: 'ok',
    provedor: 'viacep',
    dados: {
      localidade: d.localidade,
      uf: d.uf ?? '',
      ibge: d.ibge,
      logradouro: d.logradouro || undefined,
      bairro: d.bairro || undefined,
      complemento: d.complemento || undefined,
    },
  }
}

interface BrasilApiCep {
  state?: string
  city?: string
  neighborhood?: string
  street?: string
}

async function brasilApi(f: Fetch, cep: string): Promise<Resultado> {
  const r = await getJSON(f, `https://brasilapi.com.br/api/cep/v2/${cep}`, 6_000)
  if (!r || r.status >= 500 || r.status === 429) return { tipo: 'falhou' }
  if (r.status === 404) return { tipo: 'nao_encontrado' }
  const d = (r.body ?? {}) as BrasilApiCep
  if (r.status !== 200 || !d.city || !d.state) return { tipo: 'falhou' }
  // BrasilAPI não traz o código IBGE — resolve pelo nome + UF na lista local.
  const ibge = codigoIBGE(d.city, d.state)
  if (!ibge) return { tipo: 'falhou' }
  return {
    tipo: 'ok',
    provedor: 'brasilapi',
    dados: {
      localidade: d.city,
      uf: d.state,
      ibge,
      logradouro: d.street || undefined,
      bairro: d.neighborhood || undefined,
    },
  }
}

/**
 * "Não encontrado" só quando um provedor afirma que o CEP não existe e o outro
 * não o tem; falha de rede/provedor nos dois vira "indisponível" (tente de novo).
 */
export async function consultarCep(cep: string, f: Fetch = fetch): Promise<ConsultaCep> {
  const primeiro = await viaCep(f, cep)
  if (primeiro.tipo === 'ok') return primeiro
  const segundo = await brasilApi(f, cep)
  if (segundo.tipo === 'ok') return segundo
  // Basta um provedor afirmar que o CEP não existe (e o outro não achar).
  if (primeiro.tipo === 'nao_encontrado' || segundo.tipo === 'nao_encontrado') return { tipo: 'nao_encontrado' }
  return { tipo: 'indisponivel' }
}
