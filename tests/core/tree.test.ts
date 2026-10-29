import { describe, it, expect } from 'vitest'
import { flattenLinks, findNode, isProtected, otherBookmarksId, summarize, searchLinks, listFolders } from '../../src/core/tree'
import { sampleTree } from '../fixtures/sampleTree'

describe('tree', () => {
  it('flattenLinks devolve o caminho das pastas, sem a raiz', () => {
    const links = flattenLinks(sampleTree)
    expect(links.map((l) => l.id).sort()).toEqual(['10', '11', '20'])
    expect(links.find((l) => l.id === '10')!.path).toEqual(['Barra de favoritos', 'Dev'])
    expect(links.find((l) => l.id === '20')!.path).toEqual(['Outros favoritos'])
  })

  it('findNode acha nós em qualquer nível e devolve undefined para id inexistente', () => {
    expect(findNode(sampleTree, '11')?.title).toBe('GitHub')
    expect(findNode(sampleTree, '5')?.kind).toBe('folder')
    expect(findNode(sampleTree, '999')).toBeUndefined()
  })

  it('isProtected é verdadeiro para a raiz e suas filhas diretas, falso para o resto', () => {
    expect(isProtected(sampleTree, '0')).toBe(true)
    expect(isProtected(sampleTree, '1')).toBe(true)
    expect(isProtected(sampleTree, '3')).toBe(true)
    expect(isProtected(sampleTree, '5')).toBe(false)
    expect(isProtected(sampleTree, '10')).toBe(false)
  })

  it('otherBookmarksId acha a pasta de id 2', () => {
    expect(otherBookmarksId(sampleTree)).toBe('2')
  })

  it('otherBookmarksId cai para a primeira filha que não seja a barra quando não há id 2', () => {
    const tree = [{ kind: 'folder' as const, id: '0', title: '', children: [
      { kind: 'folder' as const, id: '1', parentId: '0', title: 'Barra', children: [] },
      { kind: 'folder' as const, id: '7', parentId: '0', title: 'Outros', children: [] },
    ] }]
    expect(otherBookmarksId(tree)).toBe('7')
  })

  it('otherBookmarksId explica o erro quando a árvore não tem pastas', () => {
    expect(() => otherBookmarksId([])).toThrow('vazia')
  })

  it('summarize conta links, pastas (sem a raiz) e links com dateLastUsed positivo', () => {
    expect(summarize(sampleTree)).toEqual({ links: 3, folders: 4, withLastUsed: 1 })
  })

  it('searchLinks acha por título ou URL sem diferenciar maiúsculas e respeita o limite', () => {
    const links = flattenLinks(sampleTree)
    expect(searchLinks(links, 'github').map((l) => l.id)).toEqual(['11'])
    expect(searchLinks(links, 'MOZILLA').map((l) => l.id)).toEqual(['10'])
    expect(searchLinks(links, 'https', 2)).toHaveLength(2)
  })

  it('searchLinks devolve vazio para busca em branco', () => {
    expect(searchLinks(flattenLinks(sampleTree), '   ')).toEqual([])
  })

  it('listFolders lista as pastas comuns com o caminho e ignora a raiz e suas filhas diretas', () => {
    expect(listFolders(sampleTree)).toEqual([{ id: '5', title: 'Dev', path: ['Barra de favoritos'] }])
  })

  it('flattenLinks pode pular uma pasta inteira (a Lixeira) e tudo que há nela', () => {
    expect(flattenLinks(sampleTree, '5').map((l) => l.id)).toEqual(['20'])
  })
})
