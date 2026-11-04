import { normalizeUrl } from './url'
import type { FlatLink } from './types'

/** Qual cópia fica num grupo de duplicados (seção 5.6 do design do redesenho). */
export type KeepPolicy = 'antiga' | 'especifica' | 'usada'

export interface DuplicateGroup {
  keep: FlatLink
  extras: FlatLink[]
}

const oldest = (a: FlatLink, b: FlatLink) => a.dateAdded - b.dateAdded
const deeper = (a: FlatLink, b: FlatLink) => b.path.length - a.path.length
const recent = (a: FlatLink, b: FlatLink) => (b.dateLastUsed ?? -Infinity) - (a.dateLastUsed ?? -Infinity) || 0

/** Ordem de preferência de cada política: o primeiro da ordem fica. */
const ORDER: Record<KeepPolicy, (a: FlatLink, b: FlatLink) => number> = {
  antiga: (a, b) => oldest(a, b) || deeper(a, b),
  especifica: (a, b) => deeper(a, b) || oldest(a, b),
  usada: (a, b) => recent(a, b) || oldest(a, b),
}

/**
 * Agrupa favoritos de mesmo endereço normalizado. Fica uma cópia por grupo, escolhida pela política:
 * `antiga` (padrão) = a mais antiga, no empate a mais funda; `especifica` = a mais funda, no empate a mais
 * antiga; `usada` = a de uso mais recente (sem registro conta como nunca), no empate a mais antiga.
 */
export function findDuplicates(links: FlatLink[], policy: KeepPolicy = 'antiga'): DuplicateGroup[] {
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
    const sorted = [...g].sort(ORDER[policy])
    out.push({ keep: sorted[0]!, extras: sorted.slice(1) })
  }
  return out
}

/** Grupos em que todas as cópias, inclusive a que ficaria, estão marcadas: não sobraria nenhuma. */
export function groupsFullySelected(groups: DuplicateGroup[], selected: Set<string>): DuplicateGroup[] {
  return groups.filter((g) => [g.keep, ...g.extras].every((l) => selected.has(l.id)))
}
