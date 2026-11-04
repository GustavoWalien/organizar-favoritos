export type Reason = 'sem-uso' | 'sem-registro' | 'duplicado' | 'quebrado' | 'incerto' | 'pasta-vazia'

/** Um favorito (ou pasta vazia) que a limpeza sugere mover para a Lixeira. */
export interface Candidate {
  id: string
  title: string
  url: string
  path: string[]
  reasons: Reason[]
}

/** Quando o único motivo é "incerto", a extensão não tem prova de nada: nunca vem marcado. */
export const isUncertainOnly = (c: Candidate): boolean => c.reasons.length === 1 && c.reasons[0] === 'incerto'

export function toggleOne(sel: Set<string>, id: string): Set<string> {
  const next = new Set(sel)
  if (!next.delete(id)) next.add(id)
  return next
}

/** Seleciona todos os itens da lista recebida (já filtrada), menos os que são só "incerto". */
export function selectAll(items: Candidate[]): Set<string> {
  return new Set(items.filter((c) => !isUncertainOnly(c)).map((c) => c.id))
}

export const clear = (): Set<string> => new Set()

export function filterByReason(items: Candidate[], reason: Reason | 'todos'): Candidate[] {
  return reason === 'todos' ? items : items.filter((c) => c.reasons.includes(reason))
}

/** Junta os motivos do mesmo item; a ordem é a da primeira aparição. */
export function mergeCandidates(parts: Candidate[]): Candidate[] {
  const byId = new Map<string, Candidate>()
  for (const p of parts) {
    const existing = byId.get(p.id)
    if (existing) existing.reasons = [...new Set([...existing.reasons, ...p.reasons])]
    else byId.set(p.id, { ...p, reasons: [...p.reasons] })
  }
  return [...byId.values()]
}

/** Os marcados que ainda estão na lista mostrada. O que saiu da lista (limiar novo, outra aba, árvore nova) não vai junto. */
export function visibleSelection(selected: Set<string>, list: Candidate[]): string[] {
  return list.filter((c) => selected.has(c.id)).map((c) => c.id)
}
