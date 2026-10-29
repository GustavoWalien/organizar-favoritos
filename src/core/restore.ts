import { findNode, isProtected, otherBookmarksId } from './tree'
import type { BmNode, Operation, Plan, Snapshot } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Recria `node` (e os filhos) dentro de `parentId`, que pode ser um tempId. */
function recreate(node: BmNode, parentId: string, ops: Operation[], nextTemp: () => string): void {
  if (node.kind === 'link') {
    ops.push({ op: 'create-link', parentId, title: node.title, url: node.url })
    return
  }
  const tempId = nextTemp()
  ops.push({ op: 'create-folder', tempId, parentId, title: node.title })
  for (const child of node.children) recreate(child, tempId, ops, nextTemp)
}

const counter = () => {
  let n = 0
  return () => `r${n++}`
}

/** Cria `Restaurado em <data>` em Outros favoritos com a árvore inteira do backup. Nunca sobrescreve nada. */
export function planRestoreAll(snapshot: Snapshot, current: BmNode[], now: Date): Plan {
  const nextTemp = counter()
  const ops: Operation[] = []
  const rootId = nextTemp()
  ops.push({ op: 'create-folder', tempId: rootId, parentId: otherBookmarksId(current), title: `Restaurado em ${stamp(now)}` })
  const top = snapshot.tree[0]
  for (const child of top && top.kind === 'folder' ? top.children : snapshot.tree) recreate(child, rootId, ops, nextTemp)
  return { id: `restore-all-${now.getTime()}`, label: 'Restaurar backup completo', operations: ops }
}

/** Restaura um favorito ou pasta do backup. */
export function planRestoreItem(snapshot: Snapshot, nodeId: string, current: BmNode[], now: Date): Plan {
  const node = findNode(snapshot.tree, nodeId)
  if (!node) throw new Error('Esse item não está no backup.')
  if (isProtected(snapshot.tree, nodeId)) throw new Error('As pastas raiz do Chrome não são restauradas.')

  const nextTemp = counter()
  const ops: Operation[] = []
  const plan = (): Plan => ({ id: `restore-item-${nodeId}-${now.getTime()}`, label: `Restaurar "${node.title}"`, operations: ops })

  const originalParent = node.parentId
  const parentExists = originalParent !== undefined && findNode(current, originalParent) !== undefined

  // Destino: o pai original, ou a pasta "Restaurados" (reaproveitada ou criada).
  let target: string
  if (parentExists) {
    target = originalParent!
  } else {
    const otherId = otherBookmarksId(current)
    const other = findNode(current, otherId)
    const existing = other?.kind === 'folder' ? other.children.find((c) => c.kind === 'folder' && c.title === 'Restaurados') : undefined
    if (existing) {
      target = existing.id
    } else {
      target = nextTemp()
      ops.push({ op: 'create-folder', tempId: target, parentId: otherId, title: 'Restaurados' })
    }
  }

  const present = findNode(current, nodeId)
  if (present) {
    // Ainda existe (ex.: foi para a Lixeira): move de volta em vez de duplicar.
    if (present.parentId === target) return { ...plan(), operations: [] }
    ops.push({ op: 'move', id: nodeId, toParentId: target })
  } else {
    recreate(node, target, ops, nextTemp)
  }
  return plan()
}
