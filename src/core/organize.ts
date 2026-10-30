import { findTrash } from './cleanup'
import type { MarksMap } from './marks'
import { normalizeText } from './text'
import type { BmNode } from './types'

/** Ids que têm a marca "não mexer" própria (a proteção herdada de uma pasta ancestral não entra). */
export function lockedFolderIds(marks: MarksMap): Set<string> {
  const out = new Set<string>()
  for (const [id, mark] of marks) if (mark.naoMexer) out.add(id)
  return out
}

/**
 * Dos `ids`, os que têm a marca "não mexer" própria. "Liberar" só muda esses: um item protegido só
 * pela pasta continuaria protegido, e contá-lo como liberado enganaria o aviso.
 */
export function ownMarkedIds(ids: string[], marks: MarksMap): string[] {
  return ids.filter((id) => marks.get(id)?.naoMexer === true)
}

/** Aviso de "marcado como não mexer" / "liberado", com singular e plural. */
export function protectMessage(count: number, value: boolean, what: 'favorito' | 'pasta' = 'favorito'): string {
  const one = count === 1
  const noun = what === 'pasta' ? (one ? 'pasta' : 'pastas') : one ? 'favorito' : 'favoritos'
  const fem = what === 'pasta'
  const part = value
    ? `${fem ? (one ? 'marcada' : 'marcadas') : one ? 'marcado' : 'marcados'} como não mexer`
    : fem ? (one ? 'liberada' : 'liberadas') : one ? 'liberado' : 'liberados'
  return `${count} ${noun} ${part}`
}

export interface OrganizeRow {
  id: string
  title: string
  url: string
  folderId: string
  /** Caminho da pasta atual, como "Barra de favoritos › Dev". */
  folderLabel: string
  /** Link direto numa pasta raiz do Chrome (sem pasta de verdade). */
  loose: boolean
  /** A marca "não mexer" está no próprio link. */
  own: boolean
  /** Título da pasta marcada mais próxima que protege o link, quando ele não tem marca própria. */
  inheritedFrom?: string
  sugestao: string
  aprovado: '' | 'sim' | 'nao'
}

export interface OrganizeFilters {
  query: string
  onlyLoose: boolean
  onlyProtected: boolean
  onlySuggested: boolean
  /** Pasta escolhida; inclui as subpastas. */
  folderId?: string
}

/**
 * Links da árvore (sem a Lixeira) com a proteção já resolvida, filtrados. Uma única passada:
 * leva a pasta marcada mais próxima para baixo em vez de procurar os ancestrais de cada link.
 */
export function organizeRows(tree: BmNode[], marks: MarksMap, filters: OrganizeFilters): OrganizeRow[] {
  const trashId = findTrash(tree)?.id
  const q = normalizeText(filters.query)
  const out: OrganizeRow[] = []

  // `depth` é a profundidade da pasta que contém `nodes`: 0 = nó raiz, 1 = pasta raiz do Chrome (Barra, Outros, Mobile).
  const walk = (nodes: BmNode[], path: string[], depth: number, protector: string | undefined, inFolder: boolean, folderId: string) => {
    for (const n of nodes) {
      if (n.id === trashId) continue
      if (n.kind === 'folder') {
        const next = n.parentId === undefined ? path : [...path, n.title]
        walk(n.children, next, depth + 1, marks.get(n.id)?.naoMexer ? n.title : protector, inFolder || n.id === filters.folderId, n.id)
        continue
      }
      if (filters.folderId !== undefined && !inFolder) continue
      const loose = depth === 2
      const mark = marks.get(n.id)
      const own = mark?.naoMexer === true
      const inheritedFrom = own ? undefined : protector
      const sugestao = mark?.sugestao ?? ''
      if (filters.onlyLoose && !loose) continue
      if (filters.onlyProtected && !own && inheritedFrom === undefined) continue
      if (filters.onlySuggested && !sugestao) continue
      const folderLabel = path.join(' › ')
      if (q && !normalizeText(`${n.title} ${n.url} ${folderLabel}`).includes(q)) continue
      const row: OrganizeRow = { id: n.id, title: n.title, url: n.url, folderId, folderLabel, loose, own, sugestao, aprovado: mark?.aprovado ?? '' }
      if (inheritedFrom !== undefined) row.inheritedFrom = inheritedFrom
      out.push(row)
    }
  }
  walk(tree, [], 0, undefined, false, '')
  return out
}
