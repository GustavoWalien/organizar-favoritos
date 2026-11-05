import { describe, expect, it } from 'vitest'
import { applyDomainRule } from '../../src/ai/domainRule'
import { buildScope } from '../../src/ai/scope'
import type { MarksMap } from '../../src/core/marks'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const lnk = (id: string, parentId: string, url: string): BmLink => ({ kind: 'link', id, parentId, title: id, url, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const tree = (tools: BmNode[], other: BmNode[], loose: BmNode[]): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [dir('10', '1', 'Dev', [dir('11', '10', 'Tools', tools)]), dir('12', '1', 'Outra', other), ...loose]),
    dir('2', '0', 'Outros', []),
  ]),
]
const run = (t: BmNode[], marks: MarksMap = new Map(), kind: 'sem-categoria' | 'todos' = 'sem-categoria') =>
  applyDomainRule(t, marks, buildScope(t, marks, { kind, allowNew: true }), kind)

describe('applyDomainRule', () => {
  const gh = (id: string, p: string) => lnk(id, p, `https://github.com/${id}`)
  it('pasta que concentra o domínio recebe o solto', () => {
    const t = tree([gh('a', '11'), gh('b', '11'), gh('c', '11')], [], [gh('s', '1')])
    expect(run(t)).toEqual([{ itemId: 's', folderId: '11' }])
  })
  it('um só favorito do domínio: nada', () => {
    expect(run(tree([gh('a', '11')], [], [gh('s', '1')]))).toEqual([])
  })
  it('empate 50%: nada', () => {
    expect(run(tree([gh('a', '11'), gh('b', '11')], [gh('c', '12'), gh('d', '12')], [gh('s', '1')]))).toEqual([])
  })
  it('protegidos não contam', () => {
    const t = tree([gh('a', '11'), gh('b', '11')], [], [gh('s', '1')])
    expect(run(t, new Map([['a', { id: 'a', naoMexer: true }]]))).toEqual([])
  })
  it('fora de "sem categoria": nada', () => {
    expect(run(tree([gh('a', '11'), gh('b', '11')], [], [gh('s', '1')]), new Map(), 'todos')).toEqual([])
  })
})
