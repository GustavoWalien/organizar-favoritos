import { describe, expect, it } from 'vitest'
import { contrastRatio, darkTokens, lightTokens, type Tokens } from '../../src/ui/theme/tokens'

const pairs = (t: Tokens): [string, string, string][] => [
  [t.text, t.bg, 'texto/base'],
  [t.text, t.surface, 'texto/superfície'],
  [t.text, t.raised, 'texto/elevada'],
  [t.textSecondary, t.surface, 'secundário/superfície'],
  [t.textSecondary, t.sidebar, 'secundário/lateral'],
  [t.textTertiary, t.surface, 'terciário/superfície'],
  [t.textTertiary, t.bg, 'terciário/base'],
  [t.textTertiary, t.sidebar, 'terciário/lateral'],
  [t.primaryText, t.primary, 'botão primário'],
  [t.link, t.surface, 'link/superfície'],
  [t.link, t.raised, 'link/elevada'],
  [t.warnText, t.warnBg, 'aviso'],
  [t.dangerText, t.dangerBg, 'perigo'],
  [t.okText, t.okBg, 'ok'],
]

describe('contraste dos temas', () => {
  for (const [name, tokens] of [['escuro', darkTokens], ['claro', lightTokens]] as const) {
    it(`todos os pares do tema ${name} têm contraste de pelo menos 4,5`, () => {
      for (const [fg, bg, label] of pairs(tokens)) {
        expect(contrastRatio(fg, bg), `${name}: ${label}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }

  it('contrastRatio: preto sobre branco é 21 e cores iguais dão 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5)
  })
})
