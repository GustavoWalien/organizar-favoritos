import { describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import type { BmFolder, BmNode } from '../../src/core/types'
import { prepareCleanup, preparePurge } from '../../src/ui/cleanupActions'
import { makeFakeApi } from '../fixtures/fakeApi'

const lnk = (id: string, parentId: string, url: string, dateAdded = 1): BmNode => ({ kind: 'link', id, parentId, title: id, url, dateAdded })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const tree = (barra: BmNode[], outros: BmNode[] = []): BmNode[] => [
  dir('0', '', '', [dir('1', '0', 'Barra', barra), dir('2', '0', 'Outros', outros), dir('3', '0', 'Móveis')]),
]

describe('prepareCleanup', () => {
  const dups = tree([lnk('a', '1', 'https://a.com/', 1), lnk('b', '1', 'https://a.com/', 2)])

  it('bloqueia quando todas as cópias de um grupo de duplicados foram marcadas', async () => {
    const r = await prepareCleanup(makeFakeApi(dups), ['a', 'b'], 'Limpeza')
    expect(r.blocked).toMatch(/grupo/)
    expect(r.plan.operations).toEqual([])
  })

  it('libera quando sobra ao menos uma cópia', async () => {
    const r = await prepareCleanup(makeFakeApi(dups), ['b'], 'Limpeza')
    expect(r.blocked).toBeNull()
    expect(r.moves).toBe(1)
  })

  it('uma cópia que já está na Lixeira não conta como cópia viva nem como duplicado', async () => {
    const t = tree([lnk('b', '1', 'https://a.com/', 2)], [dir('50', '2', TRASH_TITLE, [lnk('a', '50', 'https://a.com/', 1)])])
    const r = await prepareCleanup(makeFakeApi(t), ['b'], 'Limpeza')
    expect(r.blocked).toBeNull()
    expect(r.moves).toBe(1)
  })

  it('usa a árvore de agora: uma pasta que ganhou conteúdo depois da análise é ignorada', async () => {
    const api = makeFakeApi(tree([dir('6', '1', 'Vazia')]))
    await api.createLink('6', 'novo', 'https://novo.com/') // mudou fora do painel
    const r = await prepareCleanup(api, ['6'], 'Limpeza')
    expect(r.moves).toBe(0)
  })
})

describe('preparePurge', () => {
  it('conta o que há na Lixeira agora, não o que havia quando o painel abriu', async () => {
    const api = makeFakeApi(tree([], [dir('50', '2', TRASH_TITLE, [lnk('a', '50', 'https://a.com/'), lnk('b', '50', 'https://b.com/')])]))
    await api.createLink('50', 'c', 'https://c.com/')
    const r = await preparePurge(api)
    expect(r.count).toBe(3)
    expect(r.plan.operations).toEqual([{ op: 'remove', id: '50' }])
  })
})
