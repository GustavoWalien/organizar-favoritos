import { describe, expect, it } from 'vitest'
import { normalizeText } from '../../src/core/text'

describe('normalizeText', () => {
  it('ignora acento e maiúscula: "Estúdos" casa com "estudos"', () => {
    expect(normalizeText('Estúdos')).toBe('estudos')
    expect(normalizeText('Ação & Coração')).toBe('acao & coracao')
  })
  it('apara espaços e aceita vazio', () => {
    expect(normalizeText('  Lazer ')).toBe('lazer')
    expect(normalizeText('')).toBe('')
  })
})
