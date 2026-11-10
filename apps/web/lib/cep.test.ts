import { describe, expect, it } from 'vitest'
import { consultarCep } from './cep'
import { codigoIBGE, municipios } from './municipios'

// #280 — fetch falso: cada URL responde o que o cenário pede.
type Resp = { status: number; body?: unknown } | 'timeout'
function fakeFetch(viacep: Resp, brasilapi: Resp): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    const r = url.includes('viacep') ? viacep : brasilapi
    if (r === 'timeout') throw new DOMException('timeout', 'TimeoutError')
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status })
  }) as typeof fetch
}

const viaOk = { status: 200, body: { localidade: 'São Paulo', uf: 'SP', ibge: '3550308', logradouro: 'Praça da Sé' } }
const brOk = { status: 200, body: { city: 'Sao Paulo', state: 'SP', street: 'Praça da Sé', neighborhood: 'Sé' } }

describe('consultarCep', () => {
  it('usa o ViaCEP quando ele responde', async () => {
    const r = await consultarCep('01001000', fakeFetch(viaOk, 'timeout'))
    expect(r).toMatchObject({ tipo: 'ok', provedor: 'viacep', dados: { ibge: '3550308' } })
  })
  it('cai na BrasilAPI (e resolve o IBGE pelo nome) quando o ViaCEP está fora', async () => {
    for (const via of [{ status: 503 }, { status: 429 }, 'timeout'] as Resp[]) {
      const r = await consultarCep('01001000', fakeFetch(via, brOk))
      expect(r).toMatchObject({ tipo: 'ok', provedor: 'brasilapi', dados: { ibge: '3550308', uf: 'SP' } })
    }
  })
  it('CEP inexistente → nao_encontrado', async () => {
    expect(await consultarCep('99999999', fakeFetch({ status: 200, body: { erro: true } }, { status: 404 }))).toEqual({ tipo: 'nao_encontrado' })
    expect(await consultarCep('99999999', fakeFetch({ status: 200, body: { erro: 'true' } }, 'timeout'))).toEqual({ tipo: 'nao_encontrado' })
  })
  it('os dois fora do ar → indisponivel (nunca "não encontrado")', async () => {
    expect(await consultarCep('01001000', fakeFetch({ status: 500 }, { status: 502 }))).toEqual({ tipo: 'indisponivel' })
    expect(await consultarCep('01001000', fakeFetch('timeout', 'timeout'))).toEqual({ tipo: 'indisponivel' })
  })
})

describe('municipios estáticos', () => {
  it('tem a lista completa sem depender de rede', () => {
    const l = municipios()
    expect(l.length).toBeGreaterThan(5500)
    expect(new Set(l.map((m) => m.uf)).size).toBe(27)
    expect(l.find((m) => m.id === 3550308)).toEqual({ id: 3550308, nome: 'São Paulo', uf: 'SP' })
  })
  it('resolve o código IBGE pelo nome, sem acento e sem caixa', () => {
    expect(codigoIBGE('sao paulo', 'sp')).toBe('3550308')
    expect(codigoIBGE('Brasília', 'DF')).toBe('5300108')
    expect(codigoIBGE('Cidade Inexistente', 'SP')).toBeNull()
  })
})
