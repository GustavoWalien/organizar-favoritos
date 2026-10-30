import { describe, expect, it } from 'vitest'
import { PALETTE_ACTIONS, searchPalette } from '../../src/core/palette'
import type { FlatLink } from '../../src/core/types'

const link = (id: string, title: string, url: string, path: string[] = ['Barra']): FlatLink => ({
  kind: 'link', id, parentId: 'p', title, url, dateAdded: 1, path,
})
const links = [
  link('1', 'Steam', 'https://store.steampowered.com/'),
  link('2', 'Steam Community', 'https://steamcommunity.com/', ['Barra', 'Lazer']),
  link('3', 'Figma', 'https://figma.com/'),
]
const folders = [
  { id: '10', label: 'Barra › Lazer' },
  { id: '11', label: 'Barra › Estudos' },
]

describe('searchPalette', () => {
  it('busca vazia devolve só as ações', () => {
    const r = searchPalette('   ', links, folders)
    expect(r.every((i) => i.kind === 'action')).toBe(true)
    expect(r).toHaveLength(PALETTE_ACTIONS.length)
  })

  it('acha link por título e por endereço, sem diferenciar maiúscula', () => {
    expect(searchPalette('STEAM', links, folders).filter((i) => i.kind === 'link').map((i) => i.kind === 'link' && i.id)).toEqual(['1', '2'])
    expect(searchPalette('figma.com', links, folders).some((i) => i.kind === 'link' && i.id === '3')).toBe(true)
  })

  it('acha pasta pelo nome, ignorando acento', () => {
    const r = searchPalette('estudo', links, folders)
    expect(r.filter((i) => i.kind === 'folder')).toEqual([{ kind: 'folder', id: '11', label: 'Barra › Estudos' }])
  })

  it('acha ação pelo rótulo', () => {
    const r = searchPalette('backup', links, folders)
    expect(r.some((i) => i.kind === 'action' && i.id === 'backup')).toBe(true)
  })

  it('a ordem é favoritos, pastas e ações', () => {
    const kinds = searchPalette('a', links, folders).map((i) => i.kind)
    const firstFolder = kinds.indexOf('folder')
    const firstAction = kinds.indexOf('action')
    expect(kinds.lastIndexOf('link')).toBeLessThan(firstFolder)
    expect(firstFolder).toBeLessThan(firstAction)
  })

  it('respeita os limites (8 links, 6 pastas) com milhares de itens', () => {
    const many = Array.from({ length: 5000 }, (_, i) => link(String(i), `Item ${i}`, `https://site${i}.com/`))
    const manyFolders = Array.from({ length: 300 }, (_, i) => ({ id: `f${i}`, label: `Pasta ${i}` }))
    const r = searchPalette('i', many, manyFolders)
    expect(r.filter((i) => i.kind === 'link')).toHaveLength(8)
    expect(searchPalette('pasta', many, manyFolders).filter((i) => i.kind === 'folder')).toHaveLength(6)
  })

  it('texto sem resultado devolve lista vazia', () => {
    expect(searchPalette('zzzzzzzz', links, folders)).toEqual([])
  })

  it('um link ou pasta com título vazio não quebra a busca', () => {
    expect(() => searchPalette('x', [link('9', '', 'https://x.com/')], [{ id: '5', label: '' }])).not.toThrow()
    expect(searchPalette('x.com', [link('9', '', 'https://x.com/')], []).some((i) => i.kind === 'link')).toBe(true)
  })
})

describe('ação Abrir Organizar', () => {
  it('aparece na lista e é achada pelo rótulo', () => {
    expect(PALETTE_ACTIONS.some((a) => a.id === 'abrir-organizar')).toBe(true)
    expect(searchPalette('organizar', [], []).some((i) => i.kind === 'action' && i.id === 'abrir-organizar')).toBe(true)
  })
})
