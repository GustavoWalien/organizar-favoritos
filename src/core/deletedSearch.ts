import { findTrash } from './cleanup'
import { normalizeText } from './text'
import { flattenLinks } from './tree'
import type { BmLink, BmNode, Snapshot } from './types'
import { normalizeUrl } from './url'

export interface DeletedHit {
  snapshotId: string
  createdAt: number
  link: BmLink
}

const keyOf = (url: string) => normalizeUrl(url) ?? url

/**
 * Favoritos dos backups que não existem mais na árvore atual (pelo endereço normalizado), achados por
 * título ou endereço. Um resultado por endereço, do backup mais recente que o contém; a Lixeira fica de fora.
 */
export function findDeleted(snapshots: Snapshot[], current: BmNode[], query: string, limit = 50): DeletedHit[] {
  const q = normalizeText(query.trim())
  if (q.length < 2) return []
  const alive = new Set(flattenLinks(current).map((l) => keyOf(l.url)))
  const seen = new Set<string>()
  const out: DeletedHit[] = []
  for (const s of [...snapshots].sort((a, b) => b.createdAt - a.createdAt)) {
    for (const l of flattenLinks(s.tree, findTrash(s.tree)?.id)) {
      const key = keyOf(l.url)
      if (alive.has(key) || seen.has(key)) continue
      if (!normalizeText(l.title).includes(q) && !normalizeText(l.url).includes(q)) continue
      seen.add(key)
      const { path: _path, ...link } = l
      out.push({ snapshotId: s.id, createdAt: s.createdAt, link })
      if (out.length >= limit) return out
    }
  }
  return out
}
