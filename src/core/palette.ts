import type { FolderOption } from './folders'
import { normalizeText } from './text'
import type { FlatLink } from './types'

export type PaletteAction = 'backup' | 'analisar-sem-uso' | 'achar-duplicados' | 'testar-links' | 'ir-lixeira'

export const PALETTE_ACTIONS: { id: PaletteAction; label: string }[] = [
  { id: 'backup', label: 'Fazer backup agora' },
  { id: 'analisar-sem-uso', label: 'Analisar favoritos sem uso' },
  { id: 'achar-duplicados', label: 'Achar duplicados' },
  { id: 'testar-links', label: 'Testar links' },
  { id: 'ir-lixeira', label: 'Abrir a Lixeira' },
]

export type PaletteItem =
  | { kind: 'link'; id: string; title: string; url: string; path: string[] }
  | { kind: 'folder'; id: string; label: string }
  | { kind: 'action'; id: PaletteAction; label: string }

/**
 * Favoritos (título ou endereço), pastas (caminho) e ações que combinam com o texto, nessa ordem.
 * Sem texto, só as ações. Ignora acento e maiúscula.
 */
export function searchPalette(
  query: string,
  links: FlatLink[],
  folders: FolderOption[],
  limits: { links: number; folders: number } = { links: 8, folders: 6 },
): PaletteItem[] {
  const q = normalizeText(query)
  const actions = PALETTE_ACTIONS.filter((a) => !q || normalizeText(a.label).includes(q)).map((a): PaletteItem => ({ kind: 'action', ...a }))
  if (!q) return actions

  const out: PaletteItem[] = []
  let found = 0
  for (const l of links) {
    if (found >= limits.links) break
    if (normalizeText(`${l.title} ${l.url}`).includes(q)) {
      out.push({ kind: 'link', id: l.id, title: l.title, url: l.url, path: l.path })
      found++
    }
  }
  found = 0
  for (const f of folders) {
    if (found >= limits.folders) break
    if (normalizeText(f.label).includes(q)) {
      out.push({ kind: 'folder', id: f.id, label: f.label })
      found++
    }
  }
  return [...out, ...actions]
}
