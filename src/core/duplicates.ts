import { normalizeUrl } from './url'
import type { FlatLink } from './types'

/** Qual cópia fica num grupo de duplicados (seção 5.6 do design do redesenho). */
export type KeepPolicy = 'antiga' | 'especifica' | 'usada'

export interface DuplicateGroup {
  keep: FlatLink
  extras: FlatLink[]
}

/** Mantém o favorito mais antigo; no empate, o que está na pasta mais funda. */
export function findDuplicates(links: FlatLink[]): DuplicateGroup[] {
  const groups = new Map<string, FlatLink[]>()
  for (const l of links) {
    const key = normalizeUrl(l.url)
    if (key === null) continue
    const g = groups.get(key)
    if (g) g.push(l)
    else groups.set(key, [l])
  }
  const out: DuplicateGroup[] = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const sorted = [...g].sort((a, b) => a.dateAdded - b.dateAdded || b.path.length - a.path.length)
    out.push({ keep: sorted[0]!, extras: sorted.slice(1) })
  }
  return out
}

/** Grupos em que todas as cópias, inclusive a que ficaria, estão marcadas: não sobraria nenhuma. */
export function groupsFullySelected(groups: DuplicateGroup[], selected: Set<string>): DuplicateGroup[] {
  return groups.filter((g) => [g.keep, ...g.extras].every((l) => selected.has(l.id)))
}
