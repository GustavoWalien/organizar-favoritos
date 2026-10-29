import { findTrash } from './cleanup'
import { findNode } from './tree'
import type { BmFolder, BmLink, BmNode } from './types'

export interface FolderNode {
  id: string
  title: string
  /** Links em toda a subárvore. */
  count: number
  children: FolderNode[]
}

const isFolder = (n: BmNode): n is BmFolder => n.kind === 'folder'
const isLink = (n: BmNode): n is BmLink => n.kind === 'link'

function toNode(f: BmFolder): FolderNode {
  const children = f.children.filter(isFolder).map(toNode)
  const count = f.children.filter(isLink).length + children.reduce((sum, c) => sum + c.count, 0)
  return { id: f.id, title: f.title, count, children }
}

/** As filhas diretas da raiz do Chrome (Barra, Outros, Mobile) e tudo abaixo delas. */
function rootFolders(root: BmNode[]): BmFolder[] {
  const top = root[0]
  return top && isFolder(top) ? top.children.filter(isFolder) : []
}

export function buildFolderTree(root: BmNode[]): FolderNode[] {
  return rootFolders(root).map(toNode)
}

/** Subpastas da Barra, de Outros e de Mobile, na ordem, sem a Lixeira. */
export function sidebarFolders(root: BmNode[]): FolderNode[] {
  const trashId = findTrash(root)?.id
  return rootFolders(root).flatMap((r) => r.children.filter(isFolder).filter((f) => f.id !== trashId).map(toNode))
}

/** Só os links que estão direto dentro da pasta, na ordem dela. */
export function directLinks(root: BmNode[], folderId: string): BmLink[] {
  const node = findNode(root, folderId)
  return node && isFolder(node) ? node.children.filter(isLink) : []
}

/** Links que estão direto nas pastas raiz, fora de qualquer subpasta (a Lixeira é uma subpasta). */
export function uncategorizedLinks(root: BmNode[]): BmLink[] {
  return rootFolders(root).flatMap((r) => r.children.filter(isLink))
}

/** Títulos da pasta raiz do Chrome até a pasta pedida; vazio se o id não existe ou não é pasta. */
export function folderPath(root: BmNode[], folderId: string): string[] {
  const walk = (nodes: BmNode[], path: string[], top: boolean): string[] | undefined => {
    for (const n of nodes) {
      if (!isFolder(n)) continue
      const here = top ? path : [...path, n.title] // o nó raiz do Chrome não entra no caminho
      if (n.id === folderId) return here
      const found = walk(n.children, here, false)
      if (found) return found
    }
  }
  return walk(root, [], true) ?? []
}

export function findFolderNode(nodes: FolderNode[], id: string): FolderNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findFolderNode(n.children, id)
    if (found) return found
  }
}
