import { useCallback, useEffect, useRef, useState } from 'react'
import { renameNewFolder } from '../../ai/applyPlan'
import { generateProposal, type GenerateProgress } from '../../ai/generate'
import { configProblem, errorMessage, makeProvider, providerOrigin } from '../../ai/provider'
import type { AiScope } from '../../ai/scope'
import { requestOriginPermission } from '../../chrome/permissions'
import type { MarksMap } from '../../core/marks'
import type { BmNode } from '../../core/types'
import { clearProposal, loadProposal, loadProvider, saveProposal, saveProvider, type Proposal, type ProviderConfig } from '../../storage/aiStore'

export interface AiSuggestionsState {
  provider: ProviderConfig | null
  proposal: Proposal | null
  progress: GenerateProgress | null
  error: string | null
  /** Testar conexão: pede a permissão do host (precisa vir de um clique), chama o provedor e grava se der certo. */
  testProvider: (cfg: ProviderConfig) => Promise<boolean>
  generate: (scope: AiScope) => Promise<void>
  cancel: () => void
  setAccepted: (itemIds: string[], value: boolean) => void
  retarget: (itemIds: string[], folderId: string, newPath: string[]) => void
  rename: (folderId: string, oldPath: string[], newName: string) => void
  discard: () => Promise<void>
}

/** Estado das sugestões da IA: provedor guardado, geração em andamento e proposta (sempre gravada). */
export function useAiSuggestions(tree: BmNode[] | null, marks: MarksMap): AiSuggestionsState {
  const [provider, setProvider] = useState<ProviderConfig | null>(null)
  const [proposal, setProposalState] = useState<Proposal | null>(null)
  const [progress, setProgress] = useState<GenerateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    void loadProvider().then(setProvider)
    void loadProposal().then(setProposalState)
    return () => abort.current?.abort()
  }, [])

  const setProposal = useCallback((p: Proposal | null) => {
    setProposalState(p)
    void (p ? saveProposal(p) : clearProposal())
  }, [])

  const testProvider = useCallback(async (cfg: ProviderConfig) => {
    setError(null)
    const problem = configProblem(cfg)
    if (problem) { setError(problem); return false }
    // O pedido de permissão precisa vir direto do clique, antes de qualquer outra espera.
    const granted = await requestOriginPermission(providerOrigin(cfg)).catch(() => false)
    if (!granted) {
      setError(`Sem a permissão para acessar ${providerOrigin(cfg).replace('/*', '')}, a extensão não fala com o provedor.`)
      return false
    }
    try {
      await makeProvider(cfg).test(new AbortController().signal)
      await saveProvider(cfg)
      setProvider(cfg)
      return true
    } catch (e) {
      setError(errorMessage(e, cfg))
      return false
    }
  }, [])

  const generate = useCallback(async (scope: AiScope) => {
    if (!tree || !provider) return
    if (proposal && proposal.items.length > 0 && !window.confirm('Já existe uma proposta não aplicada. Gerar uma nova a substitui. Continuar?')) return
    setError(null)
    abort.current = new AbortController()
    try {
      const p = await generateProposal({
        tree, marks, scope, provider: makeProvider(provider), providerKind: provider.kind, model: provider.model,
        now: Date.now(), signal: abort.current.signal, onProgress: setProgress,
      })
      setProposal(p)
      if (p.failedBatches > 0) setError(`${p.failedBatches} ${p.failedBatches === 1 ? 'lote ficou' : 'lotes ficaram'} sem sugestão (resposta inválida, recusa ou limite de uso).`)
    } catch (e) {
      setError(errorMessage(e, provider))
    } finally {
      setProgress(null)
      abort.current = null
    }
  }, [tree, marks, provider, proposal, setProposal])

  const cancel = useCallback(() => abort.current?.abort(), [])

  const update = useCallback((fn: (p: Proposal) => Proposal) => {
    setProposalState((p) => {
      if (!p) return p
      const next = fn(p)
      void saveProposal(next)
      return next
    })
  }, [])

  const setAccepted = useCallback((ids: string[], value: boolean) => {
    const set = new Set(ids)
    update((p) => ({ ...p, items: p.items.map((it) => (set.has(it.itemId) ? { ...it, accepted: value } : it)) }))
  }, [update])

  const retarget = useCallback((ids: string[], folderId: string, newPath: string[]) => {
    const set = new Set(ids)
    update((p) => ({ ...p, items: p.items.map((it) => (set.has(it.itemId) ? { ...it, folderId, newPath, accepted: true } : it)) }))
  }, [update])

  const rename = useCallback((folderId: string, oldPath: string[], newName: string) => {
    if (!tree) return
    update((p) => renameNewFolder(p, folderId, oldPath, newName, tree))
  }, [tree, update])

  const discard = useCallback(async () => {
    setProposal(null)
  }, [setProposal])

  return { provider, proposal, progress, error, testProvider, generate, cancel, setAccepted, retarget, rename, discard }
}
