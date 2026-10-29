import { describe, expect, it } from 'vitest'
import type { FlatLink, BmFolder } from '../../src/core/types'
import { fromDuplicates, fromEmptyFolders, fromInactive, fromLinkStatuses } from '../../src/ui/candidates'

const link = (id: string, o: Partial<FlatLink> = {}): FlatLink => ({
  kind: 'link', id, parentId: 'p', title: `T${id}`, url: `https://${id}.com/`, dateAdded: 1, path: ['Barra', 'Dev'], ...o,
})

describe('candidatos', () => {
  it('fromInactive leva o motivo, o título e o caminho', () => {
    const r = fromInactive([{ link: link('a'), reason: 'sem-registro', lastTouch: 1 }])
    expect(r).toEqual([{ id: 'a', title: 'Ta', url: 'https://a.com/', path: ['Barra', 'Dev'], reasons: ['sem-registro'] }])
  })

  it('fromDuplicates lista só os extras, nunca o que fica', () => {
    const r = fromDuplicates([{ keep: link('k'), extras: [link('x'), link('y')] }])
    expect(r.map((c) => c.id)).toEqual(['x', 'y'])
    expect(r[0]!.reasons).toEqual(['duplicado'])
  })

  it('fromLinkStatuses só traz quebrado e incerto e ignora links sem resultado', () => {
    const statuses = new Map<string, 'ok' | 'quebrado' | 'incerto'>([['https://a.com/', 'ok'], ['https://b.com/', 'quebrado'], ['https://c.com/', 'incerto']])
    const r = fromLinkStatuses([link('a'), link('b'), link('c'), link('d')], statuses)
    expect(r.map((c) => [c.id, c.reasons[0]])).toEqual([['b', 'quebrado'], ['c', 'incerto']])
  })

  it('fromEmptyFolders marca o motivo pasta-vazia', () => {
    const f: BmFolder = { kind: 'folder', id: '6', parentId: '1', title: 'Vazia', children: [] }
    expect(fromEmptyFolders([f])).toEqual([{ id: '6', title: 'Vazia', url: '', path: [], reasons: ['pasta-vazia'] }])
  })
})
