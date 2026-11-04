import type { MarksMap } from '../core/marks'
import type { BmNode } from '../core/types'
import type { Proposal, ProposalItem, ProviderConfig } from '../storage/aiStore'
import { applyDomainRule } from './domainRule'
import { batchPrompt, contextPrompt, makeBatches, SYSTEM_PROMPT } from './prompt'
import { ProviderError, type Provider } from './provider'
import { buildScope, type AiScope, type Candidate } from './scope'
import { InvalidResponseError, validateResponse, type Validated } from './validate'
import { newFolderKey } from './applyPlan'

export interface GenerateProgress {
  batch: number
  batches: number
}

const RULE_REASON = 'regra: domínio já está aqui'

const isAbort = (e: unknown, signal: AbortSignal) => signal.aborted || (e instanceof DOMException && e.name === 'AbortError')

/**
 * Gera a proposta (seção 5 do design): regra de domínio primeiro, depois a IA em lotes, um de cada vez.
 * Cancelar ou bater no limite de uso devolve o que já veio; chave, modelo ou rede inválidos são relançados.
 */
export async function generateProposal(args: {
  tree: BmNode[]
  marks: MarksMap
  scope: AiScope
  provider: Provider
  providerKind: ProviderConfig['kind']
  model: string
  now: number
  signal: AbortSignal
  onProgress?: (p: GenerateProgress) => void
}): Promise<Proposal> {
  const { tree, marks, scope, provider, signal } = args
  const sc = buildScope(tree, marks, scope)
  const byId = new Map(sc.items.map((it) => [it.id, it]))
  const items: ProposalItem[] = []

  const hits = applyDomainRule(tree, marks, sc, scope.kind)
  const ruled = new Set(hits.map((h) => h.itemId))
  for (const h of hits) {
    const it = byId.get(h.itemId)!
    items.push({
      itemId: it.id, folderId: h.folderId, newPath: [], confidence: 'alta', reason: RULE_REASON,
      title: it.title, domain: it.domain, fromFolderId: it.fromFolderId, source: 'regra', accepted: true,
    })
  }

  const batches = makeBatches(sc.items.filter((it) => !ruled.has(it.id)))
  const candidates: Candidate[] = [...sc.candidates]
  const newKeys = new Set<string>()
  let failedBatches = 0
  let missing = 0

  const context = contextPrompt(sc.candidates)
  const ask = async (b: (typeof batches)[number]): Promise<Validated> => {
    const user = batchPrompt(candidates.slice(sc.candidates.length), b, scope)
    try {
      return validateResponse(await provider.classify(SYSTEM_PROMPT, context, user, signal), b, candidates, scope.allowNew, tree)
    } catch (e) {
      if (!(e instanceof InvalidResponseError)) throw e
      return validateResponse(await provider.classify(SYSTEM_PROMPT, context, user, signal), b, candidates, scope.allowNew, tree)
    }
  }

  for (let n = 0; n < batches.length; n++) {
    if (signal.aborted) break
    const b = batches[n]!
    args.onProgress?.({ batch: n + 1, batches: batches.length })
    let v: Validated
    try {
      v = await ask(b)
    } catch (e) {
      if (isAbort(e, signal)) break
      if (e instanceof InvalidResponseError || (e instanceof ProviderError && e.kind === 'refusal')) {
        failedBatches++
        missing += b.ids.length
        continue
      }
      if (e instanceof ProviderError && (e.kind === 'rate' || e.kind === 'overloaded') && items.length > 0) {
        // Para aqui; o que já veio fica como proposta parcial.
        failedBatches += batches.length - n
        missing += batches.slice(n).reduce((sum, x) => sum + x.ids.length, 0)
        break
      }
      throw e
    }

    missing += v.missing.length
    for (const s of v.suggestions) {
      const it = byId.get(s.itemId)!
      items.push({ ...s, title: it.title, domain: it.domain, fromFolderId: it.fromFolderId, source: 'ia', accepted: s.confidence !== 'baixa' })
      // Pastas novas viram candidatas para os próximos lotes.
      for (let lvl = 1; lvl <= s.newPath.length; lvl++) {
        const path = s.newPath.slice(0, lvl)
        const key = newFolderKey(s.folderId, path)
        if (newKeys.has(key)) continue
        newKeys.add(key)
        const parent = candidates.find((c) => c.folderId === s.folderId && !c.newPath)
        const segments = [...(parent?.segments ?? []), ...path]
        candidates.push({ k: candidates.length, folderId: s.folderId, label: segments.join(' › '), segments, isRoot: false, newPath: path })
      }
    }
  }

  return { createdAt: args.now, provider: args.providerKind, model: args.model, scope, items, failedBatches, missing }
}
