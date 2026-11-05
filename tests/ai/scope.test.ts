import { describe, expect, it } from 'vitest'
import { buildScope, domainKey } from '../../src/ai/scope'
import { TRASH_TITLE } from '../../src/core/cleanup'
import type { MarksMap } from '../../src/core/marks'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const lnk = (id: string, parentId: string, url = `https://${id}.example/`): BmLink => ({ kind: 'link', id, parentId, title: `T${id}`, url, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })

const tree = (): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra de favoritos', [
      dir('10', '1', 'Dev', [dir('11', '10', 'Tools', [lnk('t1', '11')]), lnk('d1', '10')]),
      lnk('s1', '1'),
      lnk('f1', '1', 'file:///x.pdf'),
    ]),
    dir('2', '0', 'Outros favoritos', [
      dir('20', '2', TRASH_TITLE, [lnk('lx', '20')]),
      dir('21', '2', 'Prot', [dir('22', '21', 'Dentro'), lnk('p1', '21')]),
      lnk('s2', '2'),
      lnk('j1', '2', 'javascript:alert(1)'),
    ]),
    dir('3', '0', 'Favoritos para dispositivos móveis', []),
  ]),
]
const marks: MarksMap = new Map([['21', { id: '21', naoMexer: true }], ['s2', { id: 's2', naoMexer: true }]])

describe('buildScope', () => {
  it('sem categoria: soltos das raízes, candidatas sem Lixeira, protegidas e Mobile', () => {
    const r = buildScope(tree(), marks, { kind: 'sem-categoria', allowNew: true })
    expect(r.items.map((i) => i.id)).toEqual(['s1'])
    expect(r.items[0]).toMatchObject({ domain: 's1.example', fromFolderId: '1', url: 'https://s1.example/' })
    expect(r.candidates.map((c) => [c.k, c.label, c.isRoot])).toEqual([
      [0, 'Barra', true],
      [1, 'Barra › Dev', false],
      [2, 'Barra › Dev › Tools', false],
      [3, 'Outros', true],
    ])
    expect(r.skipped).toEqual({ protected: 1, notWeb: 2 })
    expect(r.candidatesCut).toBe(0)
  })

  it('dentro de uma pasta: subárvore, candidatas só dentro dela', () => {
    const r = buildScope(tree(), marks, { kind: 'pasta', folderId: '10', allowNew: true })
    expect(r.items.map((i) => i.id).sort()).toEqual(['d1', 't1'])
    expect(r.candidates.map((c) => c.label)).toEqual(['Barra › Dev', 'Barra › Dev › Tools'])
    expect(r.candidates.every((c) => !c.isRoot)).toBe(true)
  })

  it('todos: tudo fora da Lixeira e sem proteção', () => {
    const r = buildScope(tree(), marks, { kind: 'todos', allowNew: true })
    expect(r.items.map((i) => i.id).sort()).toEqual(['d1', 's1', 't1'])
    expect(r.skipped.protected).toBe(2)
  })

  it('mais de 1.500 candidatas: ficam as mais rasas', () => {
    const many = Array.from({ length: 40 }, (_, a) => dir(`a${a}`, '1', `A${a}`, Array.from({ length: 40 }, (_, b) => dir(`a${a}b${b}`, `a${a}`, `B${b}`))))
    const big: BmNode[] = [dir('0', '', '', [dir('1', '0', 'Barra', many), dir('2', '0', 'Outros')])]
    const r = buildScope(big, new Map(), { kind: 'todos', allowNew: true })
    expect(r.candidates).toHaveLength(1500)
    expect(r.candidatesCut).toBe(1642 - 1500)
    expect(r.candidates.filter((c) => c.segments.length <= 2)).toHaveLength(42)
    expect(r.candidates.map((c) => c.k)).toEqual(r.candidates.map((_, i) => i))
  })

  it('domainKey', () => {
    expect(domainKey('https://WWW.Exemplo.com/a')).toBe('exemplo.com')
    expect(domainKey('file:///x')).toBeNull()
    expect(domainKey('não é url')).toBeNull()
  })
})
