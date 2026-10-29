export const DRAG_MIME = 'application/x-organizar-favoritos'

export function encodeDrag(ids: string[]): string {
  return JSON.stringify(ids)
}

/** Lê o que foi arrastado. Qualquer coisa que não seja uma lista de textos vira []. */
export function decodeDrag(data: string): string[] {
  try {
    const parsed: unknown = JSON.parse(data)
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : []
  } catch {
    return []
  }
}

/** Arrastar um item selecionado leva toda a seleção; arrastar um que não está nela leva só ele. */
export function idsToDrag(draggedId: string, selected: Set<string>): string[] {
  return selected.has(draggedId) ? [...selected] : [draggedId]
}
