import { describe, it, expect } from 'vitest'
import { validarCNPJ } from './cnpj'

describe('validarCNPJ', () => {
  it('accepts a valid CNPJ (raw digits)', () => {
    // 11.222.333/0001-81 — valid check digits
    expect(validarCNPJ('11222333000181')).toBe(true)
  })

  it('accepts a valid CNPJ (formatted)', () => {
    expect(validarCNPJ('11.222.333/0001-81')).toBe(true)
  })

  it('rejects a CNPJ with wrong check digit', () => {
    expect(validarCNPJ('11222333000182')).toBe(false)
  })

  it('rejects sequences of the same digit', () => {
    expect(validarCNPJ('00000000000000')).toBe(false)
    expect(validarCNPJ('11111111111111')).toBe(false)
    expect(validarCNPJ('99999999999999')).toBe(false)
  })

  it('rejects strings shorter than 14 digits', () => {
    expect(validarCNPJ('1234')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validarCNPJ('')).toBe(false)
  })

  it('rejects strings with invalid characters only', () => {
    expect(validarCNPJ('abcdefghijklmn')).toBe(false)
  })

  it('rejects 15-digit strings', () => {
    expect(validarCNPJ('112223330001810')).toBe(false)
  })
})
