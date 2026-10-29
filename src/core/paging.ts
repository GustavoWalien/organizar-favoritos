export const PAGE_SIZE = 200

/** Os primeiros `pages` × 200 itens. As páginas se acumulam ("Mostrar mais"). */
export function pageOf<T>(items: T[], pages: number, size = PAGE_SIZE): T[] {
  return items.slice(0, Math.max(1, pages) * size)
}

export function hasMore<T>(items: T[], pages: number, size = PAGE_SIZE): boolean {
  return items.length > Math.max(1, pages) * size
}
