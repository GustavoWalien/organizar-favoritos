import { findTrash } from '../core/cleanup'
import { folderPath } from '../core/folders'
import { isProtectedEffective, type MarksMap } from '../core/marks'
import { newPlanId } from '../core/plan'
import { normalizeText } from '../core/text'
import { findNode } from '../core/tree'
import type { BmNode, Operation, Plan } from '../core/types'
import type { Proposal, ProposalItem } from '../storage/aiStore'

export interface ProposalPlan {
  plan: Plan
  moves: number
  newFolders: number
  /** Itens aceitos que ficaram de fora porque a árvore mudou desde a sugestão. */
  changed: number
}

/** Chave de uma pasta nova: pasta existente + nomes normalizados (sem acento e maiúsculas). */
export function newFolderKey(folderId: string, newPath: string[]): string {
  return JSON.stringify([folderId, ...newPath.map(normalizeText)])
}

const isFolderId = (tree: BmNode[], id: string) => findNode(tree, id)?.kind === 'folder'

/** Ids da Lixeira da extensão e de tudo dentro dela. */
function trashIds(tree: BmNode[]): Set<string> {
  const out = new Set<string>()
  const add = (n: BmNode) => { out.add(n.id); if (n.kind === 'folder') n.children.forEach(add) }
  const t = findTrash(tree)
  if (t) add(t)
  return out
}

/**
 * Plano com os itens aceitos (seção 4.4 do design). Relê a árvore e as marcas de agora: item que
 * sumiu, mudou de pasta ou ganhou "não mexer", e destino que sumiu ou ganhou "não mexer", ficam de fora.
 */
export function planFromProposal(p: Proposal, tree: BmNode[], marks: MarksMap, _now: number): ProposalPlan {
  const operations: Operation[] = []
  const created = new Map<string, string>() // newFolderKey → tempId
  let moves = 0
  let changed = 0
  let temps = 0
  const inTrash = trashIds(tree)

  const ensureFolder = (folderId: string, path: string[]): string => {
    let parent = folderId
    for (let n = 1; n <= path.length; n++) {
      const key = newFolderKey(folderId, path.slice(0, n))
      let temp = created.get(key)
      if (!temp) {
        temp = `ia-pasta:${temps++}`
        created.set(key, temp)
        operations.push({ op: 'create-folder', tempId: temp, parentId: parent, title: path[n - 1]! })
      }
      parent = temp
    }
    return parent
  }

  for (const it of p.items) {
    if (!it.accepted) continue
    const node = findNode(tree, it.itemId)
    const stale =
      !node || node.kind !== 'link' || node.parentId !== it.fromFolderId ||
      isProtectedEffective(tree, marks, it.itemId).protected ||
      !isFolderId(tree, it.folderId) || inTrash.has(it.folderId) || inTrash.has(it.itemId) ||
      isProtectedEffective(tree, marks, it.folderId).protected
    if (stale) { changed++; continue }
    if (it.newPath.length === 0 && node.parentId === it.folderId) continue
    const target = it.newPath.length === 0 ? it.folderId : ensureFolder(it.folderId, it.newPath)
    operations.push({ op: 'move', id: it.itemId, toParentId: target })
    moves++
  }

  const label = `Sugestões da IA: ${moves} ${moves === 1 ? 'favorito' : 'favoritos'}`
  return { plan: { id: newPlanId('ia'), label, operations }, moves, newFolders: created.size, changed }
}

/**
 * Troca o último nome de uma pasta nova em todos os itens dela. Se o nome novo coincidir com uma
 * pasta irmã existente, os itens passam a apontar para ela.
 */
export function renameNewFolder(p: Proposal, folderId: string, oldPath: string[], newName: string, tree: BmNode[]): Proposal {
  const name = newName.trim().slice(0, 60)
  if (!name || oldPath.length === 0) return p
  const key = newFolderKey(folderId, oldPath)
  const renamed = [...oldPath.slice(0, -1), name]

  // Pasta irmã existente com o mesmo nome (só quando o pai é uma pasta existente).
  let target = { folderId, newPath: renamed }
  if (renamed.length === 1) {
    const parent = findNode(tree, folderId)
    const sibling = parent?.kind === 'folder'
      ? parent.children.find((c) => c.kind === 'folder' && c.id !== findTrash(tree)?.id && normalizeText(c.title) === normalizeText(name))
      : undefined
    if (sibling) target = { folderId: sibling.id, newPath: [] }
  }

  return {
    ...p,
    items: p.items.map((it) => {
      if (it.folderId !== folderId || it.newPath.length < oldPath.length) return it
      if (newFolderKey(it.folderId, it.newPath.slice(0, oldPath.length)) !== key) return it
      return { ...it, folderId: target.folderId, newPath: [...target.newPath, ...it.newPath.slice(oldPath.length)] }
    }),
  }
}

export interface TargetGroup {
  key: string
  folderId: string
  newPath: string[]
  label: string
  isNew: boolean
  items: ProposalItem[]
}

/** Itens agrupados por destino, ordenados pelo rótulo ("Barra › Dev › Nova"). */
export function groupByTarget(p: Proposal, tree: BmNode[]): TargetGroup[] {
  const groups = new Map<string, TargetGroup>()
  for (const it of p.items) {
    const key = newFolderKey(it.folderId, it.newPath)
    let g = groups.get(key)
    if (!g) {
      const label = [...folderPath(tree, it.folderId), ...it.newPath].join(' › ')
      g = { key, folderId: it.folderId, newPath: it.newPath, label, isNew: it.newPath.length > 0, items: [] }
      groups.set(key, g)
    }
    g.items.push(it)
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}
