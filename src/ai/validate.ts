import { normalizeText } from '../core/text'
import { findNode } from '../core/tree'
import type { BmNode } from '../core/types'
import type { Batch } from './prompt'
import type { Candidate } from './scope'

export type Confidence = 'alta' | 'media' | 'baixa'

export interface Suggestion {
  itemId: string
  /** Pasta existente de destino (ou pai das pastas novas). */
  folderId: string
  /** Nomes a criar abaixo de `folderId`; vazio = mover direto para ela. */
  newPath: string[]
  confidence: Confidence
  reason: string
}

export interface Validated {
  suggestions: Suggestion[]
  /** Ids do lote que ficaram sem sugestão. */
  missing: string[]
}

export class InvalidResponseError extends Error {}

const MAX_NAME = 60
const MAX_REASON = 60
const MAX_LEVELS = 2
const CONF: readonly Confidence[] = ['alta', 'media', 'baixa']

/** Subpasta direta de `parentId` com o mesmo nome (sem diferenciar maiúsculas e acentos) que é candidata. */
function existingChild(tree: BmNode[], parentId: string, name: string, candidateIds: Set<string>): string | undefined {
  const parent = findNode(tree, parentId)
  if (!parent || parent.kind !== 'folder') return undefined
  const want = normalizeText(name)
  return parent.children.find((c) => c.kind === 'folder' && candidateIds.has(c.id) && normalizeText(c.title) === want)?.id
}

/**
 * Valida a resposta de um lote (seção 5.4 do design). Lança `InvalidResponseError` se o texto não for
 * JSON com a lista `itens`; qualquer item ruim vira "sem sugestão", sem derrubar o lote.
 */
export function validateResponse(text: string, batch: Batch, candidates: Candidate[], allowNew: boolean, tree: BmNode[]): Validated {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new InvalidResponseError('Resposta não é JSON')
  }
  const itens = (data as { itens?: unknown })?.itens
  if (!Array.isArray(itens)) throw new InvalidResponseError('Resposta sem a lista "itens"')

  const byK = new Map(candidates.map((c) => [c.k, c]))
  const candidateIds = new Set(candidates.map((c) => c.folderId))
  const done = new Set<number>()
  const suggestions: Suggestion[] = []

  for (const raw of itens) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    const i = r.i
    if (typeof i !== 'number' || !Number.isInteger(i) || i < 0 || i >= batch.ids.length || done.has(i)) continue
    done.add(i)
    const cand = typeof r.pasta === 'number' ? byK.get(r.pasta) : undefined
    if (!cand) continue

    const names = (typeof r.nova === 'string' ? r.nova : '')
      .split(' / ')
      .map((n) => n.trim().slice(0, MAX_NAME))
      .filter((n) => n.length > 0)
      .slice(0, MAX_LEVELS)

    // Nomes que já existem viram pasta existente.
    let folderId = cand.folderId
    let rest = names
    while (rest.length > 0) {
      const found = existingChild(tree, folderId, rest[0]!, candidateIds)
      if (!found) break
      folderId = found
      rest = rest.slice(1)
    }
    const landsOnRoot = rest.length === 0 && candidates.find((c) => c.folderId === folderId)?.isRoot
    if (landsOnRoot) continue
    if (rest.length > 0 && !allowNew) continue

    const conf = CONF.find((c) => c === r.confianca) ?? 'baixa'
    const reason = (typeof r.motivo === 'string' ? r.motivo : '').trim().slice(0, MAX_REASON)
    suggestions.push({ itemId: batch.ids[i]!, folderId, newPath: rest, confidence: conf, reason })
  }

  const got = new Set(suggestions.map((s) => s.itemId))
  return { suggestions, missing: batch.ids.filter((id) => !got.has(id)) }
}
