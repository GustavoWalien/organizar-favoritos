import { browser } from 'wxt/browser'

/** Pede acesso a todos os sites para testar links. Precisa ser chamado por um clique do usuário. */
export function requestLinkCheckPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: ['<all_urls>'] })
}

/** Se o acesso aos sites já foi dado (não precisa de clique). */
export function hasLinkCheckPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: ['<all_urls>'] })
}
