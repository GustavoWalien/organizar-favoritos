import { browser } from 'wxt/browser'
import type { BookmarksApi } from '../core/types'
import { toBmNode } from './mapNode'

export const chromeBookmarksApi: BookmarksApi = {
  async getTree() {
    return (await browser.bookmarks.getTree()).map(toBmNode)
  },
  async get(id) {
    try {
      // `bookmarks.get` não devolve os filhos das pastas; o desfazer precisa deles para saber se uma pasta está vazia.
      const [node] = await browser.bookmarks.getSubTree(id)
      return node ? toBmNode(node) : undefined
    } catch {
      return undefined
    }
  },
  async createFolder(parentId, title) {
    return (await browser.bookmarks.create({ parentId, title })).id
  },
  async createLink(parentId, title, url) {
    return (await browser.bookmarks.create({ parentId, title, url })).id
  },
  async move(id, parentId, index) {
    await browser.bookmarks.move(id, index === undefined ? { parentId } : { parentId, index })
  },
  async remove(id) {
    // removeTree também remove links; remove() recusaria pastas com conteúdo.
    await browser.bookmarks.removeTree(id)
  },
}
