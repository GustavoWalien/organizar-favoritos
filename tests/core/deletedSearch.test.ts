import { describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import { findDeleted } from '../../src/core/deletedSearch'
import type { BmFolder, BmLink, BmNode, Snapshot } from '../../src/core/types'

const lnk = (id: string, parentId: string, title: string, url: string): BmLink => ({ kind: 'link', id, parentId, title, url, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const root = (barra: BmNode[], outros: BmNode[] = []): BmNode[] => [dir('0', '', '', [dir('1', '0', 'Barra', barra), dir('2', '0', 'Outros', outros)])]
const snap = (id: string, createdAt: number, tree: BmNode[]): Snapshot => ({ id, createdAt, reason: 'x', kind: 'auto', tree })

describe('findDeleted', () => {
  const current = root([lnk('v', '1', 'Vivo', 'https://vivo.example/')])
  const s1 = snap('s1', 10, root([lnk('a', '1', 'Receita de Pão', 'https://pao.example'), lnk('v', '1', 'Vivo', 'https://vivo.example')]))
  const s2 = snap('s2', 20, root([lnk('a', '1', 'Receita de pao', 'https://pao.example/')], [dir('t', '2', TRASH_TITLE, [lnk('t1', 't', 'Lixo pão', 'https://lixo.example')])]))

  it('menos de 2 caracteres: nada', () => {
    expect(findDeleted([s1, s2], current, 'p')).toEqual([])
    expect(findDeleted([s1, s2], current, '  ')).toEqual([])
  })

  it('sem acento e maiúsculas; um resultado por endereço, do backup mais recente', () => {
    const hits = findDeleted([s1, s2], current, 'PÃO')
    expect(hits.map((h) => [h.snapshotId, h.link.id])).toEqual([['s2', 'a']])
    expect(hits[0]!.createdAt).toBe(20)
  })

  it('busca também no endereço; o que ainda existe não aparece', () => {
    expect(findDeleted([s1], current, 'vivo')).toEqual([])
    expect(findDeleted([s1], current, 'pao.example').map((h) => h.link.id)).toEqual(['a'])
  })

  it('Lixeira do backup fica de fora; respeita o limite', () => {
    expect(findDeleted([s2], current, 'lixo')).toEqual([])
    const many = snap('m', 5, root(Array.from({ length: 10 }, (_, i) => lnk(`x${i}`, '1', `Coisa ${i}`, `https://c${i}.example`))))
    expect(findDeleted([many], current, 'coisa', 3)).toHaveLength(3)
  })
})
