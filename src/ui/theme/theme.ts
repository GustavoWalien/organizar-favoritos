import { darkTokens, lightTokens } from './tokens'

export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

export function parsePref(raw: unknown): ThemePref {
  return raw === 'light' || raw === 'system' || raw === 'dark' ? raw : 'dark'
}

export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}

const browserStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadPref(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): ThemePref {
  try {
    return parsePref(storage?.getItem(STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

export function savePref(pref: ThemePref, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, pref)
  } catch {
    // sem storage (janela anônima, bloqueio): o tema vale só nesta sessão
  }
}

const cssVar = (key: string) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

export function applyTheme(resolved: ResolvedTheme, doc: Document = document): void {
  const tokens = resolved === 'dark' ? darkTokens : lightTokens
  const root = doc.documentElement
  for (const [key, value] of Object.entries(tokens)) root.style.setProperty(cssVar(key), value)
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
}

const systemPrefersDark = (): boolean => {
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  } catch {
    return true
  }
}

/** Resolve a preferência (consultando o sistema se preciso) e aplica na página. */
export function applyPref(pref: ThemePref): void {
  applyTheme(resolveTheme(pref, systemPrefersDark()))
}
