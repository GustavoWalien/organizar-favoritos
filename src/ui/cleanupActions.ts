import { buildCleanupPlan, buildPurgePlan, findTrash } from '../core/cleanup'
import { findDuplicates, groupsFullySelected } from '../core/duplicates'
import { flattenLinks } from '../core/tree'
import type { BookmarksApi, Plan } from '../core/types'

export interface CleanupPreparation {
  plan: Plan
  moves: number
  /** Motivo pelo qual o plano não deve ser aplicado, ou null. */
  blocked: string | null
}

/** Monta o plano com a árvore de agora (não a de quando o painel abriu) e garante que sobre uma cópia de cada duplicado. */
export async function prepareCleanup(api: BookmarksApi, ids: string[], label: string): Promise<CleanupPreparation> {
  const tree = await api.getTree()
  const trash = findTrash(tree)
  const stuck = groupsFullySelected(findDuplicates(flattenLinks(tree, trash?.id)), new Set(ids))
  if (stuck.length > 0) {
    return {
      plan: buildCleanupPlan(tree, [], label),
      moves: 0,
      blocked: `${stuck.length} grupo(s) de duplicados teriam todas as cópias movidas para a Lixeira. Desmarque ao menos uma cópia de cada grupo.`,
    }
  }
  const plan = buildCleanupPlan(tree, ids, label)
  return { plan, moves: plan.operations.filter((o) => o.op === 'move').length, blocked: null }
}

/** Plano para esvaziar a Lixeira e quantos favoritos há nela agora. */
export async function preparePurge(api: BookmarksApi): Promise<{ plan: Plan; count: number }> {
  const tree = await api.getTree()
  const trash = findTrash(tree)
  return { plan: buildPurgePlan(tree), count: trash ? flattenLinks([trash]).length : 0 }
}
