import { describe, it, expect } from 'vitest'
import { createSnapshot, snapshotToJson, snapshotToNetscapeHtml } from '../../src/core/snapshot'
import type { BmNode } from '../../src/core/types'
import { sampleTree } from '../fixtures/sampleTree'

const treeWithLink = (title: string, url: string, dateAdded = 0): BmNode[] => [
  { kind: 'folder', id: '0', title: '', children: [
    { kind: 'folder', id: '1', parentId: '0', title: 'Barra', children: [
      { kind: 'link', id: '9', parentId: '1', title, url, dateAdded },
    ] },
  ] },
]

describe('snapshot', () => {
  it('snapshotToJson ida e volta preserva a árvore', () => {
    const s = createSnapshot(sampleTree, 'manual', 1_700_000_000_000)
    const back = JSON.parse(snapshotToJson(s))
    expect(back.tree).toEqual(sampleTree)
    expect(back).toMatchObject({ id: s.id, createdAt: 1_700_000_000_000, reason: 'manual' })
  })

  it('snapshotToNetscapeHtml escapa & < > " no título e na URL', () => {
    const html = snapshotToNetscapeHtml(createSnapshot(treeWithLink('A & B <x>', 'https://a.com/?q=1&r="2"'), 'manual', 0))
    expect(html).toContain('A &amp; B &lt;x&gt;')
    expect(html).toContain('HREF="https://a.com/?q=1&amp;r=&quot;2&quot;"')
  })

  it('ADD_DATE sai em segundos, não em milissegundos', () => {
    const html = snapshotToNetscapeHtml(createSnapshot(treeWithLink('t', 'https://a.com/', 1_700_000_000_000), 'm', 0))
    expect(html).toContain('ADD_DATE="1700000000"')
  })

  it('o HTML começa com o doctype do Netscape e marca a Barra como barra de favoritos', () => {
    const html = snapshotToNetscapeHtml(createSnapshot(sampleTree, 'm', 0))
    expect(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true)
    expect(html).toContain('PERSONAL_TOOLBAR_FOLDER="true"')
  })

  it('o HTML não exporta o nó raiz como pasta', () => {
    const html = snapshotToNetscapeHtml(createSnapshot(sampleTree, 'm', 0))
    expect(html).toContain('>Barra de favoritos</H3>')
    expect(html).toContain('>Dev</H3>')
    expect(html.match(/<H3/g)).toHaveLength(4) // Barra, Dev, Outros, Móveis
  })

  it('dois snapshots no mesmo instante têm ids diferentes', () => {
    expect(createSnapshot([], 'a', 5).id).not.toBe(createSnapshot([], 'a', 5).id)
  })

  it('createSnapshot com flags guarda as marcas; sem flags o snapshot não ganha o campo', () => {
    const flags = [{ id: '10', naoMexer: true }]
    expect(createSnapshot(sampleTree, 'm', 0, 'manual', flags).flags).toEqual(flags)
    expect('flags' in createSnapshot(sampleTree, 'm', 0)).toBe(false)
    expect(JSON.parse(snapshotToJson(createSnapshot(sampleTree, 'm', 0, 'auto', flags))).flags).toEqual(flags)
  })
})
