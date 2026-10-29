import type { BmFolder, BmNode, BookmarksApi } from '../../src/core/types'

export interface FakeApi extends BookmarksApi {
  /** Chamadas que mudam favoritos, na ordem. */
  calls: string[]
}

/** Árvore de favoritos em memória, com `index` e `parentId` coerentes como no Chrome. */
export function makeFakeApi(initial: BmNode[], log: string[] = []): FakeApi {
  const root = structuredClone(initial)
  let nextId = 100

  const reindex = (folder: BmFolder) =>
    folder.children.forEach((c, i) => {
      c.index = i
      c.parentId = folder.id
    })
  const reindexAll = (nodes: BmNode[]) =>
    nodes.forEach((n) => {
      if (n.kind === 'folder') {
        reindex(n)
        reindexAll(n.children)
      }
    })
  reindexAll(root)

  const locate = (id: string, nodes: BmNode[] = root): { node: BmNode; parent?: BmFolder } | undefined => {
    for (const n of nodes) {
      if (n.id === id) return { node: n }
      if (n.kind === 'folder') {
        const direct = n.children.find((c) => c.id === id)
        if (direct) return { node: direct, parent: n }
        const deep = locate(id, n.children)
        if (deep) return deep
      }
    }
    return undefined
  }
  const folderOrThrow = (id: string): BmFolder => {
    const f = locate(id)?.node
    if (!f || f.kind !== 'folder') throw new Error(`pasta ${id} não encontrada`)
    return f
  }

  const api: FakeApi = {
    calls: log,
    async getTree() {
      return structuredClone(root)
    },
    async get(id) {
      const found = locate(id)
      return found ? structuredClone(found.node) : undefined
    },
    async createFolder(parentId, title) {
      log.push(`createFolder ${parentId} ${title}`)
      const parent = folderOrThrow(parentId)
      const id = `n${nextId++}`
      parent.children.push({ kind: 'folder', id, parentId, title, children: [] })
      reindex(parent)
      return id
    },
    async createLink(parentId, title, url) {
      log.push(`createLink ${parentId} ${title}`)
      const parent = folderOrThrow(parentId)
      const id = `n${nextId++}`
      parent.children.push({ kind: 'link', id, parentId, title, url, dateAdded: 0 })
      reindex(parent)
      return id
    },
    async move(id, parentId, index) {
      log.push(`move ${id} ${parentId} ${index ?? ''}`.trim())
      const found = locate(id)
      if (!found?.parent) throw new Error(`nó ${id} não encontrado`)
      const target = folderOrThrow(parentId)
      // Como no Chrome, valida antes de mexer: um move que falha não pode deixar o nó perdido.
      const room = target.children.length - (found.parent === target ? 1 : 0)
      if (index !== undefined && index > room) throw new Error('índice fora dos limites')
      found.parent.children.splice(found.parent.children.indexOf(found.node), 1)
      reindex(found.parent)
      target.children.splice(index ?? target.children.length, 0, found.node)
      reindex(target)
    },
    async remove(id) {
      log.push(`remove ${id}`)
      const found = locate(id)
      if (!found?.parent) throw new Error(`nó ${id} não encontrado`)
      found.parent.children.splice(found.parent.children.indexOf(found.node), 1)
      reindex(found.parent)
    },
  }
  return api
}
