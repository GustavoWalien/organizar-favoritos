import { normalizeUrl } from './url'
import type { FlatLink } from './types'

export interface InactiveFinding {
  link: FlatLink
  /** `sem-registro`: o Chrome não guardou o último uso, então valeu a data em que foi adicionado. */
  reason: 'sem-uso' | 'sem-registro'
  lastTouch: number
}

const DAY_MS = 86_400_000

/** Favoritos que não são abertos há mais de `thresholdDays` dias, do mais antigo para o mais recente. */
export function findInactive(links: FlatLink[], now: number, thresholdDays = 365): InactiveFinding[] {
  const out: InactiveFinding[] = []
  for (const link of links) {
    if (normalizeUrl(link.url) === null) continue
    const hasUse = (link.dateLastUsed ?? 0) > 0
    const lastTouch = hasUse ? link.dateLastUsed! : link.dateAdded
    if (now - lastTouch > thresholdDays * DAY_MS) {
      out.push({ link, reason: hasUse ? 'sem-uso' : 'sem-registro', lastTouch })
    }
  }
  return out.sort((a, b) => a.lastTouch - b.lastTouch)
}
