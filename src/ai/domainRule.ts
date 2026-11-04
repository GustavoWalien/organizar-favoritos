import { isProtectedEffective, type MarksMap } from '../core/marks'
import type { BmNode } from '../core/types'
import { domainKey, type ScopeResult } from './scope'

export interface RuleHit {
  itemId: string
  folderId: string
}

const MIN_COUNT = 2
const MIN_SHARE = 0.6

/**
 * Regra local (seção 5.2 do design): no escopo "Sem categoria", um favorito vai para a pasta candidata
 * que já concentra o domínio dele (pelo menos 2 favoritos e 60% dos que estão em candidatas).
 * Favoritos protegidos não contam como evidência.
 */
export function applyDomainRule(tree: BmNode[], marks: MarksMap, scope: ScopeResult, kind: 'sem-categoria' | 'pasta' | 'todos' = 'sem-categoria'): RuleHit[] {
  if (kind !== 'sem-categoria') return []
  const folders = new Set(scope.candidates.filter((c) => !c.isRoot).map((c) => c.folderId))
  if (folders.size === 0 || scope.items.length === 0) return []

  // domínio → pasta → quantidade, só com links diretos de pastas candidatas.
  const byDomain = new Map<string, Map<string, number>>()
  const walk = (nodes: BmNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'folder') { walk(n.children); continue }
      if (!folders.has(n.parentId ?? '')) continue
      const d = domainKey(n.url)
      if (d === null || isProtectedEffective(tree, marks, n.id).protected) continue
      const m = byDomain.get(d) ?? new Map<string, number>()
      m.set(n.parentId!, (m.get(n.parentId!) ?? 0) + 1)
      byDomain.set(d, m)
    }
  }
  walk(tree)

  const hits: RuleHit[] = []
  for (const it of scope.items) {
    const m = byDomain.get(it.domain)
    if (!m) continue
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    let best: [string, number] | undefined
    for (const e of m) if (!best || e[1] > best[1]) best = e
    if (best && best[1] >= MIN_COUNT && best[1] >= MIN_SHARE * total) hits.push({ itemId: it.id, folderId: best[0] })
  }
  return hits
}
