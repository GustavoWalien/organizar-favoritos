import type { DuplicateGroup } from '../core/duplicates'
import { normalizeUrl } from '../core/url'

/** Trocas feitas à mão na Limpeza: chave do grupo (endereço normalizado) → id da cópia que fica. */
export type KeepOverrides = Map<string, string>

export function groupKey(g: DuplicateGroup): string {
  return normalizeUrl(g.keep.url) ?? g.keep.url
}

/** Aplica as trocas manuais. Uma troca cujo id não está mais no grupo é ignorada (vale a política). */
export function applyKeep(groups: DuplicateGroup[], overrides: KeepOverrides): DuplicateGroup[] {
  return groups.map((g) => {
    const want = overrides.get(groupKey(g))
    if (want === undefined || want === g.keep.id) return g
    const all = [g.keep, ...g.extras]
    const keep = all.find((l) => l.id === want)
    return keep ? { keep, extras: all.filter((l) => l !== keep) } : g
  })
}

/** Ids que vão para a Lixeira: as cópias a mais dos grupos incluídos. A que fica nunca entra. */
export function trashIds(groups: DuplicateGroup[], included: Set<string>): string[] {
  return groups.filter((g) => included.has(groupKey(g))).flatMap((g) => g.extras.map((l) => l.id))
}
