import { describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import { buildFolderTree, directLinks, findFolderNode, folderOptions, folderPath, sidebarFolders, uncategorizedLinks } from '../../src/core/folders'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const lnk = (id: string, parentId: string): BmLink => ({ kind: 'link', id, parentId, title: `L${id}`, url: `https://${id}.com/`, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })

/** Barra: link solto, Trabalho > Ferramentas, Estudos. Outros: Lixeira (1 link) e um link solto. */
const tree = (): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [
      lnk('s1', '1'),
      dir('10', '1', 'Trabalho', [dir('11', '10', 'Ferramentas', [lnk('a', '11'), lnk('b', '11')]), lnk('c', '10')]),
      dir('12', '1', 'Estudos', [lnk('d', '12')]),
    ]),
    dir('2', '0', 'Outros', [dir('20', '2', TRASH_TITLE, [lnk('t1', '20')]), lnk('o1', '2')]),
    dir('3', '0', 'Móveis'),
  ]),
]

describe('folders', () => {
  it('a contagem de uma pasta soma a subárvore', () => {
    const [barra] = buildFolderTree(tree())
    const trabalho = barra!.children.find((f) => f.title === 'Trabalho')!
    expect(trabalho.count).toBe(3)
    expect(trabalho.children[0]).toMatchObject({ title: 'Ferramentas', count: 2 })
    expect(barra!.count).toBe(5)
  })

  it('buildFolderTree começa pelas três pastas raiz', () => {
    expect(buildFolderTree(tree()).map((f) => f.title)).toEqual(['Barra', 'Outros', 'Móveis'])
  })

  it('sidebarFolders junta as subpastas das três raiz e deixa a Lixeira de fora', () => {
    expect(sidebarFolders(tree()).map((f) => f.title)).toEqual(['Trabalho', 'Estudos'])
  })

  it('uncategorizedLinks pega só links direto nas raiz, sem os da Lixeira nem os de subpastas', () => {
    expect(uncategorizedLinks(tree()).map((l) => l.id)).toEqual(['s1', 'o1'])
  })

  it('directLinks devolve só links diretos, na ordem da pasta, e vazio para id inexistente ou de link', () => {
    expect(directLinks(tree(), '10').map((l) => l.id)).toEqual(['c'])
    expect(directLinks(tree(), '11').map((l) => l.id)).toEqual(['a', 'b'])
    expect(directLinks(tree(), '999')).toEqual([])
    expect(directLinks(tree(), 'a')).toEqual([])
  })

  it('pastas com o mesmo nome ou título vazio têm ids distintos e contagens próprias', () => {
    const t = tree()
    const barra = (t[0] as BmFolder).children[0] as BmFolder
    barra.children.push(dir('30', '1', 'Docs', [lnk('x', '30')]), dir('31', '1', 'Docs', [lnk('y', '31'), lnk('z', '31')]), dir('32', '1', '', []))
    const folders = sidebarFolders(t)
    const docs = folders.filter((f) => f.title === 'Docs')
    expect(docs.map((f) => [f.id, f.count])).toEqual([['30', 1], ['31', 2]])
    expect(folders.find((f) => f.id === '32')).toMatchObject({ title: '', count: 0 })
  })

  it('uma árvore sem pastas ou só com a raiz devolve listas vazias', () => {
    expect(buildFolderTree([])).toEqual([])
    expect(sidebarFolders([dir('0', '', '')])).toEqual([])
    expect(uncategorizedLinks([])).toEqual([])
  })

  it('folderPath devolve os títulos da pasta raiz até a pasta', () => {
    expect(folderPath(tree(), '11')).toEqual(['Barra', 'Trabalho', 'Ferramentas'])
    expect(folderPath(tree(), '1')).toEqual(['Barra'])
    expect(folderPath(tree(), '999')).toEqual([])
  })

  it('findFolderNode acha uma pasta da árvore de contagens em qualquer nível', () => {
    expect(findFolderNode(buildFolderTree(tree()), '11')).toMatchObject({ title: 'Ferramentas', count: 2 })
    expect(findFolderNode(buildFolderTree(tree()), '999')).toBeUndefined()
  })

  it('folderOptions lista as pastas raiz e as subpastas com o caminho, sem a Lixeira', () => {
    const opts = folderOptions(tree())
    expect(opts.map((o) => o.label)).toEqual([
      'Barra', 'Barra › Trabalho', 'Barra › Trabalho › Ferramentas', 'Barra › Estudos', 'Outros', 'Móveis',
    ])
    expect(opts.find((o) => o.label === 'Barra › Trabalho')?.id).toBe('10')
  })

  it('folderOptions com pastas de nome vazio ou repetido mantém ids distintos', () => {
    const t = tree()
    const barra = (t[0] as BmFolder).children[0] as BmFolder
    barra.children.push(dir('30', '1', 'Docs'), dir('31', '1', 'Docs'), dir('32', '1', ''))
    const ids = folderOptions(t).map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(folderOptions(t).find((o) => o.id === '32')?.label).toBe('Barra › (sem nome)')
  })
})
