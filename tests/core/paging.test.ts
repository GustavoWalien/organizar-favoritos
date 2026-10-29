import { describe, expect, it } from 'vitest'
import { hasMore, pageOf, PAGE_SIZE } from '../../src/core/paging'

const items = Array.from({ length: 450 }, (_, i) => i)

describe('paginação', () => {
  it('cada página tem 200 itens e as páginas se acumulam', () => {
    expect(PAGE_SIZE).toBe(200)
    expect(pageOf(items, 1)).toHaveLength(200)
    expect(pageOf(items, 2)).toHaveLength(400)
  })
  it('nunca passa do total', () => {
    expect(pageOf(items, 3)).toHaveLength(450)
    expect(pageOf(items, 99)).toHaveLength(450)
  })
  it('página menor que 1 vale 1 e lista vazia devolve vazio', () => {
    expect(pageOf(items, 0)).toHaveLength(200)
    expect(pageOf([], 1)).toEqual([])
  })
  it('hasMore diz se ainda faltam itens', () => {
    expect(hasMore(items, 2)).toBe(true)
    expect(hasMore(items, 3)).toBe(false)
    expect(hasMore([], 1)).toBe(false)
  })
  it('suporta milhares de itens', () => {
    const big = Array.from({ length: 50_000 }, (_, i) => i)
    expect(pageOf(big, 1)).toHaveLength(200)
  })
})
