import { describe, expect, it } from 'vitest'
import { domainOf, lastUsedLabel } from '../../src/ui/format'

const DAY = 86_400_000
const NOW = 1_800_000_000_000

describe('domainOf', () => {
  it('tira o www e devolve só o domínio', () => {
    expect(domainOf('https://www.github.com/a/b?x=1')).toBe('github.com')
    expect(domainOf('http://sub.exemplo.com.br:8080/')).toBe('sub.exemplo.com.br:8080')
  })
  it('URL inválida ou que não é web devolve o texto original, sem lançar', () => {
    expect(domainOf('não é url')).toBe('não é url')
    expect(domainOf('javascript:void(0)')).toBe('javascript:void(0)')
    expect(domainOf('')).toBe('')
  })
})

describe('lastUsedLabel', () => {
  it('sem data de último uso (ausente ou 0), diz "sem registro"', () => {
    expect(lastUsedLabel(undefined, NOW)).toBe('sem registro')
    expect(lastUsedLabel(0, NOW)).toBe('sem registro')
  })
  it('hoje, ontem e dias', () => {
    expect(lastUsedLabel(NOW - 1000, NOW)).toBe('hoje')
    expect(lastUsedLabel(NOW - DAY, NOW)).toBe('ontem')
    expect(lastUsedLabel(NOW - 5 * DAY, NOW)).toBe('há 5 dias')
  })
  it('meses e anos, com singular', () => {
    expect(lastUsedLabel(NOW - 30 * DAY, NOW)).toBe('há 1 mês')
    expect(lastUsedLabel(NOW - 95 * DAY, NOW)).toBe('há 3 meses')
    expect(lastUsedLabel(NOW - 365 * DAY, NOW)).toBe('há 1 ano')
    expect(lastUsedLabel(NOW - 800 * DAY, NOW)).toBe('há 2 anos')
  })
  it('data no futuro (relógio mudou) vira "hoje"', () => {
    expect(lastUsedLabel(NOW + 5 * DAY, NOW)).toBe('hoje')
  })
})
