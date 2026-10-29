interface ChangeEvent {
  addListener(cb: () => void): void
  removeListener(cb: () => void): void
}

/** Os eventos de `chrome.bookmarks` que mudam a árvore. */
export interface BookmarkEvents {
  onCreated: ChangeEvent
  onRemoved: ChangeEvent
  onChanged: ChangeEvent
  onMoved: ChangeEvent
  onChildrenReordered: ChangeEvent
  onImportEnded: ChangeEvent
}

const EVENT_NAMES: (keyof BookmarkEvents)[] = ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded']

/**
 * Avisa quando os favoritos mudam (por este painel, pelo Chrome, por sincronização ou por outra aba).
 * Várias mudanças seguidas viram um aviso só, `delayMs` depois da última. Devolve a função que para de escutar.
 */
export function watchBookmarks(events: BookmarkEvents, onChange: () => void, delayMs = 250): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const handler = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, delayMs)
  }
  // `chrome.bookmarks` mistura eventos com métodos (get, getTree…): só os eventos de mudança entram.
  const all = EVENT_NAMES.map((name) => events[name]).filter((e): e is ChangeEvent => typeof e?.addListener === 'function')
  for (const e of all) e.addListener(handler)
  return () => {
    clearTimeout(timer)
    for (const e of all) e.removeListener(handler)
  }
}
