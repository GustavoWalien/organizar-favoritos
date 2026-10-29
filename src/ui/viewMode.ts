export type ViewMode = 'lista' | 'cards' | 'compacto'

const KEY = 'viewMode'

export function parseViewMode(raw: unknown): ViewMode {
  return raw === 'cards' || raw === 'compacto' ? raw : 'lista'
}

const browserStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadViewMode(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): ViewMode {
  try {
    return parseViewMode(storage?.getItem(KEY))
  } catch {
    return 'lista'
  }
}

export function saveViewMode(mode: ViewMode, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): void {
  try {
    storage?.setItem(KEY, mode)
  } catch {
    // sem storage: vale só nesta sessão
  }
}
