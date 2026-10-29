import type { Browser } from 'wxt/browser'
import type { BmNode } from '../core/types'

export function toBmNode(n: Browser.bookmarks.BookmarkTreeNode): BmNode {
  if (n.url === undefined) {
    return {
      kind: 'folder',
      id: n.id,
      parentId: n.parentId,
      index: n.index,
      title: n.title,
      dateAdded: n.dateAdded,
      children: (n.children ?? []).map(toBmNode),
    }
  }
  return {
    kind: 'link',
    id: n.id,
    parentId: n.parentId ?? '',
    index: n.index,
    title: n.title,
    url: n.url,
    dateAdded: n.dateAdded ?? 0,
    dateLastUsed: n.dateLastUsed,
  }
}
