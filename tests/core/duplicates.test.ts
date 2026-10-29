import { describe, expect, it } from 'vitest'
import { findDuplicates, groupsFullySelected } from '../../src/core/duplicates'
import type { FlatLink } from '../../src/core/types'

const link = (id: string, url: string, dateAdded: number, path: string[] = ['Barra']): FlatLink => ({
  kind: 'link', id, parentId: 'p', title: id, url, dateAdded, path,
})

describe('findDuplicates', () => {
  it('mantém o mais antigo e lista os extras', () => {
    const groups = findDuplicates([link('b', 'https://a.com/x', 20), link('a', 'https://a.com/x', 10), link('c', 'https://a.com/x', 30)])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.keep.id).toBe('a')
    expect(groups[0]!.extras.map((l) => l.id)).toEqual(['b', 'c'])
  })

  it('mesma URL só com utm_source ou barra final diferente conta como duplicada', () => {
    const groups = findDuplicates([link('a', 'https://a.com/x', 1), link('b', 'https://a.com/x/?utm_source=news', 2)])
    expect(groups[0]!.extras.map((l) => l.id)).toEqual(['b'])
  })

  it('no empate de data, fica o que está na pasta mais específica', () => {
    const groups = findDuplicates([link('raso', 'https://a.com/', 5, ['Barra']), link('fundo', 'https://a.com/', 5, ['Barra', 'Dev', 'Docs'])])
    expect(groups[0]!.keep.id).toBe('fundo')
  })

  it('URLs diferentes não formam grupo, e um item sozinho também não', () => {
    expect(findDuplicates([link('a', 'https://a.com/1', 1), link('b', 'https://a.com/2', 2)])).toEqual([])
  })

  it('favoritelets e URLs não web nunca entram em grupos de duplicados', () => {
    const bm = 'javascript:(function(){alert(1)})()'
    expect(findDuplicates([link('a', bm, 1), link('b', bm, 2), link('c', 'chrome://settings', 3), link('d', 'chrome://settings', 4)])).toEqual([])
  })

  it('groupsFullySelected acusa o grupo em que todas as cópias, inclusive a que fica, foram marcadas', () => {
    const groups = findDuplicates([link('a', 'https://a.com/', 1), link('b', 'https://a.com/', 2), link('c', 'https://z.com/', 1), link('d', 'https://z.com/', 2)])
    expect(groupsFullySelected(groups, new Set(['a', 'b', 'd'])).map((g) => g.keep.id)).toEqual(['a'])
    expect(groupsFullySelected(groups, new Set(['b', 'd']))).toEqual([])
  })
})
