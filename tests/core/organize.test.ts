import { describe, expect, it } from 'vitest'
import { lockedFolderIds, organizeRows, protectMessage, type OrganizeFilters } from '../../src/core/organize'
import { TRASH_TITLE } from '../../src/core/cleanup'
import type { BmNode } from '../../src/core/types'
import { sampleTree } from '../fixtures/sampleTree'
import type { ItemMark, MarksMap } from '../../src/core/marks'

const marks = (...list: ItemMark[]): MarksMap => new Map(list.map((m) => [m.id, m]))

describe('lockedFolderIds', () => {
  it('devolve só os ids com naoMexer', () => {
    const m = marks({ id: 'a', naoMexer: true }, { id: 'b', sugestao: 'X' }, { id: 'c', naoMexer: false }, { id: 'd', naoMexer: true, aprovado: 'sim' })
    expect([...lockedFolderIds(m)].sort()).toEqual(['a', 'd'])
  })

  it('mapa vazio dá conjunto vazio', () => {
    expect(lockedFolderIds(new Map()).size).toBe(0)
  })
})

describe('protectMessage', () => {
  it('marcar, singular e plural', () => {
    expect(protectMessage(1, true)).toBe('1 favorito marcado como não mexer')
    expect(protectMessage(3, true)).toBe('3 favoritos marcados como não mexer')
  })

  it('liberar, singular e plural', () => {
    expect(protectMessage(1, false)).toBe('1 favorito liberado')
    expect(protectMessage(2, false)).toBe('2 favoritos liberados')
  })

  it('pastas', () => {
    expect(protectMessage(1, true, 'pasta')).toBe('1 pasta marcada como não mexer')
    expect(protectMessage(2, true, 'pasta')).toBe('2 pastas marcadas como não mexer')
    expect(protectMessage(1, false, 'pasta')).toBe('1 pasta liberada')
    expect(protectMessage(2, false, 'pasta')).toBe('2 pastas liberadas')
  })
})

const none: OrganizeFilters = { query: '', onlyLoose: false, onlyProtected: false, onlySuggested: false }
const ids = (rows: { id: string }[]) => rows.map((r) => r.id)

describe('organizeRows', () => {
  it('lista todos os links com pasta e solto', () => {
    const rows = organizeRows(sampleTree, new Map(), none)
    expect(ids(rows)).toEqual(['10', '11', '20'])
    expect(rows[0]).toMatchObject({ title: 'MDN', folderId: '5', folderLabel: 'Barra de favoritos › Dev', loose: false, own: false, sugestao: '', aprovado: '' })
    expect(rows[2]).toMatchObject({ folderId: '2', folderLabel: 'Outros favoritos', loose: true })
  })

  it('árvore vazia dá lista vazia', () => {
    expect(organizeRows([], new Map(), none)).toEqual([])
  })

  it('busca sem acento em título, endereço e pasta', () => {
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, query: 'gíthub' }))).toEqual(['11'])
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, query: 'mozilla.org' }))).toEqual(['10'])
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, query: 'barra de favoritos' }))).toEqual(['10', '11'])
  })

  it('onlyLoose', () => {
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, onlyLoose: true }))).toEqual(['20'])
  })

  it('onlySuggested usa a sugestão da marca', () => {
    const m = marks({ id: '10', sugestao: 'Estudos', aprovado: 'sim' }, { id: '11', naoMexer: true })
    const rows = organizeRows(sampleTree, m, { ...none, onlySuggested: true })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: '10', sugestao: 'Estudos', aprovado: 'sim' })
  })

  it('own e inheritedFrom; onlyProtected inclui o protegido só por herança', () => {
    const m = marks({ id: '11', naoMexer: true }, { id: '5', naoMexer: true })
    const rows = organizeRows(sampleTree, m, none)
    expect(rows.find((r) => r.id === '11')).toMatchObject({ own: true })
    expect(rows.find((r) => r.id === '11')?.inheritedFrom).toBeUndefined()
    expect(rows.find((r) => r.id === '10')).toMatchObject({ own: false, inheritedFrom: 'Dev' })
    expect(rows.find((r) => r.id === '20')).toMatchObject({ own: false })
    expect(ids(organizeRows(sampleTree, m, { ...none, onlyProtected: true }))).toEqual(['10', '11'])
    expect(ids(organizeRows(sampleTree, marks({ id: '10', naoMexer: true }), { ...none, onlyProtected: true }))).toEqual(['10'])
  })

  it('a pasta marcada mais próxima é a que protege', () => {
    const m = marks({ id: '1', naoMexer: true }, { id: '5', naoMexer: true })
    expect(organizeRows(sampleTree, m, none).find((r) => r.id === '10')?.inheritedFrom).toBe('Dev')
    expect(organizeRows(sampleTree, marks({ id: '1', naoMexer: true }), none).find((r) => r.id === '10')?.inheritedFrom).toBe('Barra de favoritos')
  })

  it('folderId filtra pela pasta e subpastas', () => {
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, folderId: '1' }))).toEqual(['10', '11'])
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, folderId: '5' }))).toEqual(['10', '11'])
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, folderId: '2' }))).toEqual(['20'])
    expect(ids(organizeRows(sampleTree, new Map(), { ...none, folderId: '3' }))).toEqual([])
  })

  it('filtros combinados', () => {
    const m = marks({ id: '10', naoMexer: true, sugestao: 'X' }, { id: '20', naoMexer: true })
    expect(ids(organizeRows(sampleTree, m, { ...none, onlyProtected: true, onlyLoose: true }))).toEqual(['20'])
    expect(ids(organizeRows(sampleTree, m, { ...none, onlyProtected: true, onlySuggested: true, query: 'mdn' }))).toEqual(['10'])
    expect(ids(organizeRows(sampleTree, m, { ...none, onlyProtected: true, onlySuggested: true, folderId: '2' }))).toEqual([])
  })

  it('nunca lista a Lixeira', () => {
    const tree: BmNode[] = JSON.parse(JSON.stringify(sampleTree))
    const outros = (tree[0] as { children: BmNode[] }).children[1] as { children: BmNode[] }
    outros.children.push({
      kind: 'folder', id: '90', parentId: '2', title: TRASH_TITLE,
      children: [{ kind: 'link', id: '91', parentId: '90', title: 'Velho', url: 'https://velho.test/', dateAdded: 1 }],
    })
    expect(ids(organizeRows(tree, new Map(), none))).toEqual(['10', '11', '20'])
  })

  it('milhares de links rápido (sem andar na árvore por link)', () => {
    const links: BmNode[] = Array.from({ length: 4000 }, (_, i) => ({ kind: 'link', id: `l${i}`, parentId: 'f', title: `Link ${i}`, url: `https://s${i}.test/`, dateAdded: 1 }))
    const deep: BmNode = { kind: 'folder', id: 'f', parentId: '1', title: 'Grande', children: links }
    const tree: BmNode[] = [{ kind: 'folder', id: '0', title: '', children: [
      { kind: 'folder', id: '1', parentId: '0', title: 'Barra de favoritos', children: [deep] },
      { kind: 'folder', id: '2', parentId: '0', title: 'Outros favoritos', children: [] },
    ] }]
    const start = performance.now()
    const rows = organizeRows(tree, marks({ id: 'f', naoMexer: true }), { ...none, onlyProtected: true })
    expect(rows).toHaveLength(4000)
    expect(rows[0]?.inheritedFrom).toBe('Grande')
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
