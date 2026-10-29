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
  const all = Object.values(events) as ChangeEvent[]
  for (const e of all) e.addListener(handler)
  return () => {
    clearTimeout(timer)
    for (const e of all) e.removeListener(handler)
  }
}
