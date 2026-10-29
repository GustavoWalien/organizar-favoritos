import { runPlan, newPlanId } from './plan'
import { findNode, otherBookmarksId } from './tree'
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
  /** O plano aplicado (para desfazer exatamente ele); ausente quando nada foi movido. */
  planId?: string
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
  const moved = plan.operations.length - failed
  return { moved, skipped: unique - plan.operations.length, failed, targetTitle, planId: moved > 0 ? result.entry.planId : undefined }
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

/** Plano para criar uma pasta. Sem pai válido (ou com um link como pai), cria em "Outros favoritos". */
export function planCreateFolder(root: BmNode[], parentId: string | undefined, title: string): Plan {
  const name = title.trim()
  const id = newPlanId('folder')
  if (!name) return { id, label: 'Nova pasta', operations: [] }
  const parent = parentId ? findNode(root, parentId) : undefined
  const target = parent && parent.kind === 'folder' ? parent.id : otherBookmarksId(root)
  return { id, label: `Nova pasta "${name}"`, operations: [{ op: 'create-folder', tempId: 'nova', parentId: target, title: name }] }
}
