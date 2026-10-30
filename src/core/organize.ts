import type { MarksMap } from './marks'

/** Ids que têm a marca "não mexer" própria (a proteção herdada de uma pasta ancestral não entra). */
export function lockedFolderIds(marks: MarksMap): Set<string> {
  const out = new Set<string>()
  for (const [id, mark] of marks) if (mark.naoMexer) out.add(id)
  return out
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
