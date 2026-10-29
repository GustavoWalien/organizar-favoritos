import { describe, it, expect } from 'vitest'
import { toBmNode } from '../../src/chrome/mapNode'

describe('toBmNode', () => {
  it('nó sem url vira pasta com filhos mapeados', () => {
    const n = toBmNode({ id: '5', parentId: '1', index: 0, title: 'Dev', dateAdded: 1, syncing: false, children: [
      { id: '10', parentId: '5', index: 0, title: 'MDN', url: 'https://mdn.dev/', dateAdded: 2, dateLastUsed: 3, syncing: false },
    ] })
    expect(n).toMatchObject({ kind: 'folder', id: '5', title: 'Dev' })
    expect(n.kind === 'folder' && n.children[0]).toMatchObject({ kind: 'link', id: '10', url: 'https://mdn.dev/', dateLastUsed: 3 })
  })

  it('link sem dateLastUsed fica sem o campo', () => {
    const n = toBmNode({ id: '11', parentId: '5', title: 'x', url: 'https://x.dev/', dateAdded: 2, syncing: false })
    expect(n.kind === 'link' && n.dateLastUsed).toBeUndefined()
  })
})
