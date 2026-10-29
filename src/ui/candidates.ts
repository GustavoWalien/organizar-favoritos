import type { DuplicateGroup } from '../core/duplicates'
import type { InactiveFinding } from '../core/inactive'
import type { LinkStatus } from '../core/linkStatus'
import type { BmFolder, FlatLink } from '../core/types'
import type { Candidate } from './selection'

const fromLink = (l: FlatLink, reason: Candidate['reasons'][number]): Candidate => ({
  id: l.id, title: l.title, url: l.url, path: l.path, reasons: [reason],
})

export const fromInactive = (findings: InactiveFinding[]): Candidate[] => findings.map((f) => fromLink(f.link, f.reason))

export const fromDuplicates = (groups: DuplicateGroup[]): Candidate[] =>
  groups.flatMap((g) => g.extras.map((l) => fromLink(l, 'duplicado')))

export function fromLinkStatuses(links: FlatLink[], statuses: Map<string, LinkStatus>): Candidate[] {
  const out: Candidate[] = []
  for (const l of links) {
    const s = statuses.get(l.url)
    if (s === 'quebrado' || s === 'incerto') out.push(fromLink(l, s))
  }
  return out
}

export const fromEmptyFolders = (folders: BmFolder[]): Candidate[] =>
  folders.map((f) => ({ id: f.id, title: f.title, url: '', path: [], reasons: ['pasta-vazia' as const] }))
