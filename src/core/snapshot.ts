import type { ItemMark } from './marks'
import type { BmNode, Snapshot } from './types'

let counter = 0

export function createSnapshot(
  tree: BmNode[],
  reason: string,
  now: number,
  kind: 'auto' | 'manual' = 'auto',
  flags?: ItemMark[],
): Snapshot {
  counter++
  const snapshot: Snapshot = { id: `${now}-${counter.toString(36)}`, createdAt: now, reason, kind, tree }
  if (flags) snapshot.flags = flags
  return snapshot
}

export function snapshotToJson(s: Snapshot): string {
  return JSON.stringify(s, null, 2)
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const seconds = (ms: number | undefined) => Math.floor((ms ?? 0) / 1000)

/** Formato Netscape, que qualquer navegador importa. O nó raiz não vira pasta. */
export function snapshotToNetscapeHtml(s: Snapshot): string {
  const lines: string[] = []
  const render = (nodes: BmNode[], depth: number) => {
    const pad = '    '.repeat(depth)
    for (const n of nodes) {
      if (n.kind === 'link') {
        lines.push(`${pad}<DT><A HREF="${escapeHtml(n.url)}" ADD_DATE="${seconds(n.dateAdded)}">${escapeHtml(n.title)}</A>`)
      } else {
        const toolbar = n.id === '1' ? ' PERSONAL_TOOLBAR_FOLDER="true"' : ''
        lines.push(`${pad}<DT><H3 ADD_DATE="${seconds(n.dateAdded)}"${toolbar}>${escapeHtml(n.title)}</H3>`)
        lines.push(`${pad}<DL><p>`)
        render(n.children, depth + 1)
        lines.push(`${pad}</DL><p>`)
      }
    }
  }
  const top = s.tree[0]
  render(top && top.kind === 'folder' ? top.children : s.tree, 1)
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...lines,
    '</DL><p>',
    '',
  ].join('\n')
}
