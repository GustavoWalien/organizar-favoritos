import type { BmNode, FlatLink } from './types'

/** Todos os links com o caminho das pastas. `skipFolderId` deixa de fora uma pasta inteira (a Lixeira). */
export function flattenLinks(root: BmNode[], skipFolderId?: string): FlatLink[] {
  const out: FlatLink[] = []
  const walk = (nodes: BmNode[], path: string[]) => {
    for (const n of nodes) {
      if (n.id === skipFolderId) continue
      if (n.kind === 'link') out.push({ ...n, path })
      else walk(n.children, n.parentId === undefined ? path : [...path, n.title])
    }
  }
  walk(root, [])
  return out
}

export function findNode(root: BmNode[], id: string): BmNode | undefined {
  for (const n of root) {
    if (n.id === id) return n
    if (n.kind === 'folder') {
      const found = findNode(n.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** O nó raiz e as pastas filhas dele (Barra, Outros, Mobile) nunca são alteradas pela extensão. */
export function isProtected(root: BmNode[], id: string): boolean {
  return root.some(
    (top) => top.id === id || (top.kind === 'folder' && top.children.some((c) => c.id === id)),
  )
}

/** Id da pasta "Outros favoritos" (id '2' no Chrome); senão a primeira filha da raiz que não seja a Barra ('1'). */
export function otherBookmarksId(root: BmNode[]): string {
  const top = root[0]
  const children = top && top.kind === 'folder' ? top.children : []
  const other = children.find((c) => c.id === '2') ?? children.find((c) => c.id !== '1') ?? children[0]
  if (!other) throw new Error('A árvore de favoritos está vazia: não há pasta raiz para usar.')
  return other.id
}

export interface TreeSummary {
  links: number
  /** Pastas sem contar o nó raiz. */
  folders: number
  /** Links com `dateLastUsed` maior que 0. */
  withLastUsed: number
}

export function summarize(root: BmNode[]): TreeSummary {
  const s: TreeSummary = { links: 0, folders: 0, withLastUsed: 0 }
  const walk = (nodes: BmNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'link') {
        s.links++
        if ((n.dateLastUsed ?? 0) > 0) s.withLastUsed++
      } else {
        if (n.parentId !== undefined) s.folders++
        walk(n.children)
      }
    }
  }
  walk(root)
  return s
}

/** Busca por título ou URL, sem diferenciar maiúsculas. Busca em branco devolve vazio. */
export function searchLinks(links: FlatLink[], query: string, limit = 50): FlatLink[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: FlatLink[] = []
  for (const l of links) {
    if (l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)) {
      out.push(l)
      if (out.length >= limit) break
    }
  }
  return out
}

export interface FolderInfo {
  id: string
  title: string
  path: string[]
}

/** Pastas comuns (sem a raiz nem as filhas diretas dela), com os títulos dos ancestrais. */
export function listFolders(root: BmNode[]): FolderInfo[] {
  const out: FolderInfo[] = []
  const walk = (nodes: BmNode[], path: string[]) => {
    for (const n of nodes) {
      if (n.kind !== 'folder') continue
      if (!isProtected(root, n.id)) out.push({ id: n.id, title: n.title, path })
      walk(n.children, n.parentId === undefined ? path : [...path, n.title])
    }
  }
  walk(root, [])
  return out
}
