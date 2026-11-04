import { describe, expect, it } from 'vitest'
import { findDuplicates } from '../../src/core/duplicates'
import type { FlatLink } from '../../src/core/types'
import { applyKeep, groupKey, trashIds } from '../../src/ui/duplicateChoice'

const link = (id: string, url: string, dateAdded: number): FlatLink => ({ kind: 'link', id, parentId: 'p', title: id, url, dateAdded, path: ['Barra'] })

const groups = () => findDuplicates([
  link('a1', 'https://a.example/', 1), link('a2', 'https://a.example', 2), link('a3', 'https://A.example/', 3),
  link('b1', 'https://b.example', 1), link('b2', 'https://b.example', 2),
])

describe('duplicateChoice', () => {
  it('groupKey é o endereço normalizado', () => {
    expect(groups().map(groupKey)).toEqual(['https://a.example', 'https://b.example'])
  })

  it('override troca a cópia que fica; a antiga vai para extras', () => {
    const g = applyKeep(groups(), new Map([['https://a.example', 'a3']]))
    expect(g[0]!.keep.id).toBe('a3')
    expect(g[0]!.extras.map((l) => l.id).sort()).toEqual(['a1', 'a2'])
    expect(g[1]!.keep.id).toBe('b1')
  })

  it('override com id que não está mais no grupo é ignorado', () => {
    const g = applyKeep(groups(), new Map([['https://a.example', 'sumiu'], ['https://nada.example', 'a1']]))
    expect(g[0]!.keep.id).toBe('a1')
    expect(g).toHaveLength(2)
  })

  it('trashIds: só extras dos grupos incluídos, nunca todas as cópias', () => {
    const g = groups()
    expect(trashIds(g, new Set(['https://a.example'])).sort()).toEqual(['a2', 'a3'])
    expect(trashIds(g, new Set(['https://a.example', 'https://b.example'])).sort()).toEqual(['a2', 'a3', 'b2'])
    expect(trashIds(g, new Set())).toEqual([])
    for (const grp of g) expect(trashIds(g, new Set(g.map(groupKey)))).not.toContain(grp.keep.id)
  })
})
