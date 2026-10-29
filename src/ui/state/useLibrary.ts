import { useCallback, useEffect, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { describeMove, moveLinks, planCreateFolder } from '../../core/moves'
import { BackupFailedError, runPlan, undoLast } from '../../core/plan'
import { prepareCleanup } from '../cleanupActions'
import type { BmNode, JournalEntry } from '../../core/types'
import { lastEntry } from '../../storage/journal'

export interface ToastState {
  id: number
  message: string
  /** O botão "Desfazer" só aparece quando algo foi de fato movido. */
  undoable: boolean
}

const errorText = (e: unknown) => (e instanceof BackupFailedError ? e.message : `Erro: ${e instanceof Error ? e.message : String(e)}`)

/** A árvore de favoritos, o último plano aplicado e as ações que mudam favoritos, com aviso e Desfazer. */
export function useLibrary() {
  const [tree, setTree] = useState<BmNode[] | null>(null)
  const [lastInfo, setLastInfo] = useState<Pick<JournalEntry, 'label' | 'appliedAt'> | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const fresh = await chromeBookmarksApi.getTree()
    setTree(fresh)
    const last = await lastEntry()
    setLastInfo(last ? { label: last.label, appliedAt: last.appliedAt } : null)
    return fresh
  }, [])
  useEffect(() => { void reload() }, [reload])

  const notify = (message: string, undoable = false) => setToast({ id: Date.now(), message, undoable })

  const move = useCallback(async (ids: string[], folderId: string) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await moveLinks(chromeBookmarksApi, ids, folderId, Date.now())
      await reload()
      notify(describeMove(result), result.moved > 0)
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  const trash = useCallback(async (ids: string[]) => {
    if (busy) return
    setBusy(true)
    try {
      const { plan, moves, blocked } = await prepareCleanup(chromeBookmarksApi, ids, 'Mover para a Lixeira')
      if (blocked) {
        notify(blocked)
        return
      }
      if (moves === 0) {
        notify('Nada para mover: os favoritos já estão na Lixeira ou mudaram')
        return
      }
      const r = await runPlan(plan, chromeBookmarksApi, Date.now(), undefined, { shareBackup: true })
      await reload()
      const moved = moves - r.failed.length
      notify(`${moved} ${moved === 1 ? 'favorito movido' : 'favoritos movidos'} para a Lixeira`, moved > 0)
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  const createFolder = useCallback(async (title: string, parentId?: string) => {
    if (busy) return
    setBusy(true)
    try {
      const plan = planCreateFolder(await chromeBookmarksApi.getTree(), parentId, title)
      if (plan.operations.length === 0) {
        notify('Dê um nome à pasta')
        return
      }
      const r = await runPlan(plan, chromeBookmarksApi, Date.now(), undefined, { shareBackup: true })
      await reload()
      notify(r.failed.length ? `Não foi possível criar a pasta: ${r.failed[0]?.error}` : `Pasta "${title.trim()}" criada`, r.applied > 0)
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  const undo = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await undoLast(chromeBookmarksApi)
      await reload()
      notify(r ? `Desfeito${r.relocated ? ` (${r.relocated} foram para Outros favoritos porque a pasta de origem mudou)` : ''}` : 'Não há nada para desfazer')
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  return { tree, reload, move, trash, createFolder, undo, lastInfo, toast, dismissToast: () => setToast(null), notify, busy }
}
