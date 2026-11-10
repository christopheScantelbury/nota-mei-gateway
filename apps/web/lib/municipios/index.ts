import lista from './municipios.json'
import { normalize } from '@/lib/municipio'

/**
 * Municípios do IBGE embutidos no build (#280). O IBGE não responde a partir
 * da Vercel, então nada aqui depende de rede em tempo de execução.
 * Atualizar: `node scripts/atualizar-municipios.mjs` (na raiz do repo).
 */
export interface MunicipioSimples {
  id: number
  nome: string
  uf: string
}

type Linha = [number, string, string]

let cache: MunicipioSimples[] | null = null
let porChave: Map<string, MunicipioSimples> | null = null

/** Lista completa { id, nome, uf }, ordenada por nome. */
export function municipios(): MunicipioSimples[] {
  if (!cache) cache = (lista as Linha[]).map(([id, nome, uf]) => ({ id, nome, uf }))
  return cache
}

/** Código IBGE (7 dígitos) a partir do nome + UF, ignorando acentos e caixa. */
export function codigoIBGE(nome: string, uf: string): string | null {
  if (!porChave) {
    porChave = new Map(municipios().map((m) => [`${normalize(m.nome)}|${m.uf}`, m]))
  }
  const m = porChave.get(`${normalize(nome.trim())}|${uf.trim().toUpperCase()}`)
  return m ? String(m.id).padStart(7, '0') : null
}
