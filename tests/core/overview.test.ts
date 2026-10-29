import { describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import { computeOverview } from '../../src/core/overview'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const DAY = 86_400_000
const NOW = 1_800_000_000_000
const lnk = (id: string, parentId: string, url: string, ageDays: number): BmLink => ({ kind: 'link', id, parentId, title: id, url, dateAdded: NOW - ageDays * DAY })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })

/**
 * Barra: a (500 dias, nunca aberto) e b (mesma URL de a, 10 dias) soltos.
 * Outros: o (5 dias) solto e a Lixeira com t1 (700 dias, mesma URL de a).
 */
const tree = (): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [lnk('a', '1', 'https://a.com/', 500), lnk('b', '1', 'https://a.com/', 10)]),
    dir('2', '0', 'Outros', [lnk('o', '2', 'https://o.com/', 5), dir('20', '2', TRASH_TITLE, [lnk('t1', '20', 'https://a.com/', 700)])]),
    dir('3', '0', 'Móveis'),
  ]),
]

describe('computeOverview', () => {
  it('total não conta os links da Lixeira e trash conta só eles', () => {
    expect(computeOverview(tree(), NOW)).toMatchObject({ total: 3, trash: 1 })
  })

  it('inactive e duplicates ignoram a Lixeira (um link já descartado não volta a ser contado)', () => {
    const r = computeOverview(tree(), NOW)
    expect(r.inactive).toBe(1) // só "a"; "t1" está na Lixeira
    expect(r.duplicates).toBe(1) // a e b; t1 não forma grupo
  })

  it('uncategorized conta só links diretos nas pastas raiz', () => {
    const t = tree()
    ;((t[0] as BmFolder).children[0] as BmFolder).children.push(dir('10', '1', 'Trabalho', [lnk('c', '10', 'https://c.com/', 1)]))
    expect(computeOverview(t, NOW).uncategorized).toBe(3) // a, b, o — não o "c" de dentro de Trabalho
  })

  it('o limiar de dias é ajustável', () => {
    expect(computeOverview(tree(), NOW, 5000).inactive).toBe(0)
    expect(computeOverview(tree(), NOW, 100).inactive).toBe(1)
  })

  it('uma coleção vazia devolve tudo zero', () => {
    expect(computeOverview([], NOW)).toEqual({ total: 0, inactive: 0, duplicates: 0, uncategorized: 0, trash: 0 })
    expect(computeOverview([dir('0', '', '')], NOW)).toEqual({ total: 0, inactive: 0, duplicates: 0, uncategorized: 0, trash: 0 })
  })
})
