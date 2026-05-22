import { describe, it, expect } from 'vitest'
import {
  formatBRL,
  formatMoneyFromCents,
  formatCNPJ,
  formatCPF,
  formatDoc,
  formatCEP,
  maskCNPJ,
  maskCPF,
  maskCEP,
  formatCompetencia,
} from './format'

// Intl currency usa espaço não-quebrável ( ) entre "R$" e o número.
const nbsp = ' '

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(1)).toBe(`R$${nbsp}1,00`)
    expect(formatBRL(1234.5)).toBe(`R$${nbsp}1.234,50`)
  })
  it('retorna — para null/undefined/NaN', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(undefined)).toBe('—')
    expect(formatBRL(NaN)).toBe('—')
  })
})

describe('formatMoneyFromCents', () => {
  it('divide centavos por 100', () => {
    expect(formatMoneyFromCents(2990, 'BRL')).toBe(`R$${nbsp}29,90`)
  })
})

describe('documentos (exibição)', () => {
  it('formata CNPJ', () => {
    expect(formatCNPJ('34488964000142')).toBe('34.488.964/0001-42')
  })
  it('formata CPF', () => {
    expect(formatCPF('00256647275')).toBe('002.566.472-75')
  })
  it('formatDoc detecta CPF vs CNPJ pelo tamanho', () => {
    expect(formatDoc('34488964000142')).toBe('34.488.964/0001-42')
    expect(formatDoc('00256647275')).toBe('002.566.472-75')
    expect(formatDoc(null)).toBe('—')
  })
  it('formata CEP', () => {
    expect(formatCEP('69074370')).toBe('69074-370')
  })
})

describe('máscaras progressivas', () => {
  it('maskCNPJ', () => {
    expect(maskCNPJ('34')).toBe('34')
    expect(maskCNPJ('34488')).toBe('34.488')
    expect(maskCNPJ('34488964000142')).toBe('34.488.964/0001-42')
  })
  it('maskCPF', () => {
    expect(maskCPF('002566')).toBe('002.566')
    expect(maskCPF('00256647275')).toBe('002.566.472-75')
  })
  it('maskCEP', () => {
    expect(maskCEP('69074')).toBe('69074')
    expect(maskCEP('69074370')).toBe('69074-370')
  })
})

describe('formatCompetencia', () => {
  it('converte AAAA-MM para MM/AAAA', () => {
    expect(formatCompetencia('2026-05')).toBe('05/2026')
  })
  it('retorna — para vazio', () => {
    expect(formatCompetencia(null)).toBe('—')
  })
})
