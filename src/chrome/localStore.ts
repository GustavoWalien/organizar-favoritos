/** Armazenamento chave/valor; `chromeLocalStore` em produção, um Map nos testes. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

/** `chrome.storage.local`, compartilhado entre o painel e o popup. */
export const chromeLocalStore: KeyValueStore = {
  async get(key) {
    const r = await browser.storage.local.get(key)
    return r[key]
  },
  async set(key, value) {
    await browser.storage.local.set({ [key]: value })
  },
}
