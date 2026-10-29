import { runPlan, newPlanId } from './plan'
import { findNode } from './tree'
import type { BmNode, BookmarksApi, Operation, Plan } from './types'

/** Plano para mover links para uma pasta. Ignora o que não é link, repetidos, inexistentes e o que já está no destino. */
export function planMoveLinks(root: BmNode[], linkIds: string[], targetFolderId: string): Plan {
  const id = newPlanId('move')
  const target = findNode(root, targetFolderId)
  if (!target || target.kind !== 'folder') return { id, label: 'Mover favoritos', operations: [] }

  const seen = new Set<string>()
  const operations: Operation[] = []
  for (const linkId of linkIds) {
    if (seen.has(linkId)) continue
    seen.add(linkId)
    const node = findNode(root, linkId)
    if (!node || node.kind !== 'link' || node.parentId === target.id) continue
    operations.push({ op: 'move', id: linkId, toParentId: target.id })
  }
  const n = operations.length
  return { id, label: `Mover ${n} ${n === 1 ? 'favorito' : 'favoritos'} para "${target.title}"`, operations }
}

export interface MoveResult {
  moved: number
  /** Ignorados: já estavam no destino, sumiram ou não eram links. */
  skipped: number
  /** Falharam na hora de mover. */
  failed: number
  targetTitle: string
}

/** Move links usando a árvore de agora; os movimentos em sequência compartilham o backup automático. */
export async function moveLinks(api: BookmarksApi, linkIds: string[], targetFolderId: string, now: number): Promise<MoveResult> {
  const tree = await api.getTree()
  const target = findNode(tree, targetFolderId)
  const targetTitle = target?.title ?? ''
  const plan = planMoveLinks(tree, linkIds, targetFolderId)
  const unique = new Set(linkIds).size
  if (plan.operations.length === 0) return { moved: 0, skipped: unique, failed: 0, targetTitle }

  const result = await runPlan(plan, api, now, undefined, { shareBackup: true })
  const failed = result.failed.length
  return { moved: plan.operations.length - failed, skipped: unique - plan.operations.length, failed, targetTitle }
}

export function describeMove(r: MoveResult): string {
  const notMoved = r.skipped + r.failed
  if (r.moved === 0) {
    return r.failed > 0
      ? `Não foi possível mover ${r.failed} ${r.failed === 1 ? 'favorito' : 'favoritos'} para "${r.targetTitle}"`
      : `Nada para mover: os favoritos já estão em "${r.targetTitle}" ou mudaram`
  }
  const base = `${r.moved} ${r.moved === 1 ? 'favorito movido' : 'favoritos movidos'} para "${r.targetTitle}"`
  return notMoved > 0 ? `${base} (${notMoved} não ${notMoved === 1 ? 'foi movido' : 'foram movidos'})` : base
}
