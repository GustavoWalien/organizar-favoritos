import { findTrash } from './cleanup'
import { findDuplicates } from './duplicates'
import { uncategorizedLinks } from './folders'
import { findInactive } from './inactive'
import { flattenLinks } from './tree'
import type { BmNode } from './types'

export interface Overview {
  /** Favoritos fora da Lixeira. */
  total: number
  /** Sem uso há mais de `thresholdDays`. */
  inactive: number
  /** Cópias a mais (cada grupo conta os extras, não a que fica). */
  duplicates: number
  /** Direto nas pastas raiz, fora de qualquer subpasta. */
  uncategorized: number
  /** Dentro da Lixeira. */
  trash: number
}

/** Os números do resumo. A Lixeira fica de fora de tudo, menos de `trash`. */
export function computeOverview(root: BmNode[], now: number, thresholdDays = 365): Overview {
  const trash = findTrash(root)
  const live = flattenLinks(root, trash?.id)
  return {
    total: live.length,
    inactive: findInactive(live, now, thresholdDays).length,
    duplicates: findDuplicates(live).reduce((sum, g) => sum + g.extras.length, 0),
    uncategorized: uncategorizedLinks(root).length,
    trash: trash ? flattenLinks([trash]).length : 0,
  }
}
