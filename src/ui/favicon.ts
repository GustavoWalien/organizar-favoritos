/**
 * Ícone do site pelo cache do próprio Chrome (permissão `favicon`, MV3): a extensão não acessa o site.
 * Sem ícone em cache, o Chrome devolve o globo padrão, que serve de ícone neutro.
 */
export function faviconUrl(pageUrl: string, base: string | null = defaultBase()): string | null {
  if (!pageUrl || !base) return null
  return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
}

function defaultBase(): string | null {
  try {
    const id = typeof browser !== 'undefined' ? browser.runtime?.id : undefined
    return id ? `chrome-extension://${id}/_favicon/` : null
  } catch {
    return null
  }
}
