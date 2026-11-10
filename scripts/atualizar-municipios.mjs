#!/usr/bin/env node
// Atualiza apps/web/lib/municipios/municipios.json a partir do IBGE (#280).
//
// A rota /api/municipios NÃO consulta o IBGE em tempo de execução: o IBGE não
// responde a partir da Vercel. A lista (~5.570 municípios) muda raramente —
// rode este script quando o IBGE criar/renomear município e commite o JSON.
//
//   node scripts/atualizar-municipios.mjs
//
// Formato: [[id, "Nome", "UF"], ...] ordenado por nome (compacto; a rota
// expande para { id, nome, uf }).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const URL_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome'
const URL_BRASILAPI = (uf) => `https://brasilapi.com.br/api/ibge/municipios/v1/${uf}?providers=dados-abertos-br,gov,wikipedia`
const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ')

async function doIBGE() {
  const res = await fetch(URL_IBGE, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`IBGE HTTP ${res.status}`)
  const raw = await res.json()
  return raw.map((m) => [
    m.id,
    m.nome,
    m.microrregiao?.mesorregiao?.UF?.sigla ?? m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ?? '',
  ])
}

async function doBrasilAPI() {
  const out = []
  for (const uf of UFS) {
    const res = await fetch(URL_BRASILAPI(uf), { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`BrasilAPI ${uf} HTTP ${res.status}`)
    for (const m of await res.json()) out.push([Number(m.codigo_ibge), m.nome, uf])
  }
  return out.sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
}

let lista
try {
  lista = await doIBGE()
} catch (err) {
  console.warn(`IBGE falhou (${err.message}) — usando BrasilAPI`)
  lista = await doBrasilAPI()
}
lista = lista.filter(([id, nome, uf]) => id && nome && uf)
if (lista.length < 5500) throw new Error(`lista suspeita: só ${lista.length} municípios`)

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', 'lib', 'municipios', 'municipios.json')
writeFileSync(destino, JSON.stringify(lista) + '\n')
console.log(`${lista.length} municípios → ${destino}`)
