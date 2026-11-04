import { describe, expect, it } from 'vitest'
import { formatRoute, parseRoute, type View } from '../../src/core/route'

describe('rota no #', () => {
  it('ida e volta para todas as telas', () => {
    const views: View[] = [
      { name: 'overview' },
      { name: 'cleanup' },
      { name: 'cleanup', tab: 'sem-uso' },
      { name: 'cleanup', tab: 'duplicados' },
      { name: 'cleanup', tab: 'quebrados' },
      { name: 'cleanup', tab: 'pastas-vazias' },
      { name: 'folder', id: '123' },
      { name: 'uncategorized' },
      { name: 'organize' },
      { name: 'backups' },
      { name: 'trash' },
      { name: 'ai' },
    ]
    for (const v of views) expect(parseRoute(formatRoute(v)), JSON.stringify(v)).toEqual(v)
  })

  it('formatos exatos', () => {
    expect(formatRoute({ name: 'overview' })).toBe('#/')
    expect(formatRoute({ name: 'cleanup', tab: 'duplicados' })).toBe('#/limpeza/duplicados')
    expect(formatRoute({ name: 'cleanup' })).toBe('#/limpeza')
    expect(formatRoute({ name: 'folder', id: '42' })).toBe('#/pasta/42')
    expect(formatRoute({ name: 'uncategorized' })).toBe('#/sem-categoria')
    expect(formatRoute({ name: 'organize' })).toBe('#/organizar')
    expect(formatRoute({ name: 'backups' })).toBe('#/backups')
    expect(formatRoute({ name: 'trash' })).toBe('#/lixeira')
    expect(formatRoute({ name: 'ai' })).toBe('#/ia')
  })

  it('endereço desconhecido ou malformado cai na Visão geral', () => {
    for (const h of ['', '#', '#/', '#/xyz', '#/pasta/', '#/pasta', 'lixo', '#/backups/extra/coisa']) {
      expect(parseRoute(h), h).toEqual({ name: 'overview' })
    }
  })

  it('aba desconhecida da Limpeza abre a Limpeza sem aba', () => {
    expect(parseRoute('#/limpeza/abc')).toEqual({ name: 'cleanup' })
  })

  it('id da pasta é codificado', () => {
    expect(formatRoute({ name: 'folder', id: 'a/b' })).toBe('#/pasta/a%2Fb')
    expect(parseRoute('#/pasta/a%2Fb')).toEqual({ name: 'folder', id: 'a/b' })
    expect(parseRoute('#/pasta/%E0%A4%A')).toEqual({ name: 'overview' })
  })

  it('a rota nunca carrega ação: parâmetros são ignorados', () => {
    expect(parseRoute('#/limpeza/quebrados?testar')).toEqual({ name: 'cleanup', tab: 'quebrados' })
  })
})
