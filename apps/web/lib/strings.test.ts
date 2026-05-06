import { describe, it, expect } from 'vitest'
import { firstWord } from './strings'

describe('firstWord', () => {
  it('returns the first word of a multi-word string', () => {
    expect(firstWord('Teste Business MEI')).toBe('Teste')
  })

  it('returns the only word when there is no space', () => {
    expect(firstWord('Maria')).toBe('Maria')
  })

  it('returns the full string when it contains no space (e.g. email)', () => {
    expect(firstWord('dev@empresa.com')).toBe('dev@empresa.com')
  })

  it('returns empty string for empty input', () => {
    expect(firstWord('')).toBe('')
  })

  it('returns empty string when the string starts with a space', () => {
    // split(' ') on '  Espaço  ' yields ['', '', 'Espaço', '', '']
    expect(firstWord('  Espaço  ')).toBe('')
  })
})
