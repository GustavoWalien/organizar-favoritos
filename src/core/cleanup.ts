import { newPlanId } from './plan'
import { isProtected, otherBookmarksId } from './tree'
import type { BmFolder, BmNode, Operation, Plan } from './types'

export const TRASH_TITLE = 'Lixeira (Organizar Favoritos)'

const hasLinks = (f: BmFolder): boolean => f.children.some((c) => c.kind === 'link' || hasLinks(c))

/** A Lixeira fica sempre em "Outros favoritos". */
export function findTrash(root: BmNode[]): BmFolder | undefined {
  const other = (root[0] as BmFolder | undefined)?.children.find((c) => c.id === otherBookmarksId(root))
  return other?.kind === 'folder'
    ? (other.children.find((c) => c.kind === 'folder' && c.title === TRASH_TITLE) as BmFolder | undefined)
    : undefined
}

/** As pastas vazias mais externas (sem links em nenhum nível), fora as raiz e a Lixeira. */
export function findEmptyFolders(root: BmNode[]): BmFolder[] {
  const trash = findTrash(root)
  const out: BmFolder[] = []
  const walk = (nodes: BmNode[]) => {
    for (const n of nodes) {
      if (n.kind !== 'folder' || n.id === trash?.id) continue
      if (!isProtected(root, n.id) && !hasLinks(n)) out.push(n)
      else walk(n.children)
    }
  }
  walk(root)
  return out
}

function find(root: BmNode[], id: string): BmNode | undefined {
  for (const n of root) {
    if (n.id === id) return n
    if (n.kind === 'folder') {
      const f = find(n.children, id)
      if (f) return f
    }
  }
}

/**
 * Move para a Lixeira os links indicados e as pastas vazias indicadas. Ignora pastas raiz,
 * pastas com conteúdo, ids que não existem e o que já está na Lixeira.
 */
export function buildCleanupPlan(root: BmNode[], ids: string[], label: string): Plan {
  const trash = findTrash(root)
  const empties = new Set(findEmptyFolders(root).map((f) => f.id))
  const valid = [...new Set(ids)].filter((id) => {
    const n = find(root, id)
    if (!n || isProtected(root, id) || n.id === trash?.id) return false
    if (n.kind === 'folder' && !empties.has(id)) return false
    return n.parentId !== trash?.id
  })
  if (valid.length === 0) return { id: newPlanId('cleanup'), label, operations: [] }

  const ops: Operation[] = []
  let target: string
  if (trash) {
    target = trash.id
  } else {
    target = 'lixeira'
    ops.push({ op: 'create-folder', tempId: target, parentId: otherBookmarksId(root), title: TRASH_TITLE })
  }
  for (const id of valid) ops.push({ op: 'move', id, toParentId: target })
  return { id: newPlanId('cleanup'), label, operations: ops }
}

/** Remove a Lixeira inteira. Não tem desfazer; o backup é a rede de segurança. */
export function buildPurgePlan(root: BmNode[]): Plan {
  const trash = findTrash(root)
  return { id: newPlanId('purge'), label: 'Esvaziar a Lixeira', operations: trash ? [{ op: 'remove', id: trash.id }] : [] }
}
