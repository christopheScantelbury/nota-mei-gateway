import { describe, it, expect } from 'vitest'
import { normalize, toCode } from './municipio'

describe('normalize', () => {
  it('strips diacritics and lowercases São Paulo', () => {
    expect(normalize('São Paulo')).toBe('sao paulo')
  })

  it('strips diacritics and lowercases Florianópolis', () => {
    expect(normalize('Florianópolis')).toBe('florianopolis')
  })

  it('lowercases an all-uppercase string', () => {
    expect(normalize('CURITIBA')).toBe('curitiba')
  })

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('')
  })
})

describe('toCode', () => {
  it('returns a 7-digit code unchanged when already 7 digits', () => {
    expect(toCode(3550308)).toBe('3550308')
  })

  it('zero-pads a 6-digit number to 7 digits', () => {
    expect(toCode(123456)).toBe('0123456')
  })

  it('leaves a 7-digit number as-is', () => {
    expect(toCode(1234567)).toBe('1234567')
  })
})
