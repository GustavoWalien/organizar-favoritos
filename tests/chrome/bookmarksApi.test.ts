import { describe, expect, it, vi } from 'vitest'

// O chrome.bookmarks.get real devolve o nó SEM `children`; só getSubTree traz os filhos.
vi.mock('wxt/browser', () => ({
  browser: {
    bookmarks: {
      get: vi.fn(async (id: string) => [{ id, parentId: '2', title: 'Pasta', syncing: false }]),
      getSubTree: vi.fn(async (id: string) => [
        { id, parentId: '2', title: 'Pasta', syncing: false, children: [{ id: '9', parentId: id, title: 'x', url: 'https://x.dev/', syncing: false }] },
      ]),
    },
  },
}))

import { chromeBookmarksApi } from '../../src/chrome/bookmarksApi'

describe('chromeBookmarksApi.get', () => {
  it('devolve a pasta com os filhos, para o desfazer saber se ela está vazia', async () => {
    const node = await chromeBookmarksApi.get('5')
    expect(node?.kind === 'folder' && node.children.map((c) => c.id)).toEqual(['9'])
  })
})
