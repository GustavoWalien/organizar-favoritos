import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { watchBookmarks } from '../../chrome/watch'
import { describeMove, moveLinks, planCreateFolder } from '../../core/moves'
import { BackupFailedError, runPlan, undoIfLatest, undoLast } from '../../core/plan'
import { prepareCleanup } from '../cleanupActions'
import { patchMark, type ItemMark, type MarksMap } from '../../core/marks'
import { protectMessage } from '../../core/organize'
import type { BmNode, JournalEntry } from '../../core/types'
import { marksStore } from '../../storage/flags'
import { lastEntry } from '../../storage/journal'

export interface ToastState {
  id: number
  message: string
  /** O botão "Desfazer" só aparece quando algo foi de fato movido. */
  undoable: boolean
  /** O plano que o botão "Desfazer" do aviso desfaz. */
  planId?: string
}

const errorText = (e: unknown) => (e instanceof BackupFailedError ? e.message : `Erro: ${e instanceof Error ? e.message : String(e)}`)

/** A árvore de favoritos, o último plano aplicado e as ações que mudam favoritos, com aviso e Desfazer. */
export function useLibrary() {
  const [tree, setTree] = useState<BmNode[] | null>(null)
  const [lastInfo, setLastInfo] = useState<Pick<JournalEntry, 'label' | 'appliedAt'> | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const [marks, setMarks] = useState<MarksMap>(() => new Map())

  const reload = useCallback(async () => {
    const fresh = await chromeBookmarksApi.getTree()
    setTree(fresh)
    const last = await lastEntry()
    setLastInfo(last ? { label: last.label, appliedAt: last.appliedAt } : null)
    setMarks(new Map((await marksStore.all()).map((m) => [m.id, m])))
    return fresh
  }, [])
  useEffect(() => { void reload() }, [reload])

  // Qualquer mudança nos favoritos (Limpeza, Backups, Chrome, sincronização) atualiza a árvore do painel.
  useEffect(() => watchBookmarks(browser.bookmarks, () => { void reload() }), [reload])

  const notify = (message: string, undoable = false, planId?: string) => setToast({ id: Date.now(), message, undoable, planId })

  const move = useCallback(async (ids: string[], folderId: string) => {
    if (busy) return
    setBusy(true)
    try {
      const result = await moveLinks(chromeBookmarksApi, ids, folderId, Date.now())
      await reload()
      notify(describeMove(result), result.moved > 0, result.planId)
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
      notify(`${moved} ${moved === 1 ? 'favorito movido' : 'favoritos movidos'} para a Lixeira`, moved > 0, moved > 0 ? r.entry.planId : undefined)
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
      notify(r.failed.length ? `Não foi possível criar a pasta: ${r.failed[0]?.error}` : `Pasta "${title.trim()}" criada`, r.applied > 0, r.applied > 0 ? r.entry.planId : undefined)
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  /** Desfaz o plano `planId` (se ainda for o mais recente) ou, sem id, o mais recente. Devolve se desfez. */
  const undo = useCallback(async (planId?: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    try {
      const r = planId ? await undoIfLatest(chromeBookmarksApi, planId) : await undoLast(chromeBookmarksApi)
      await reload()
      if (r === 'outdated') {
        notify('Esse movimento não é mais o mais recente: desfaça primeiro o que veio depois')
        return false
      }
      notify(r ? `Desfeito${r.relocated ? ` (${r.relocated} foram para Outros favoritos porque a pasta de origem mudou)` : ''}` : 'Não há nada para desfazer')
      return r !== null
    } catch (e) {
      notify(errorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [busy, reload])

  /** Marca ou libera "não mexer" nos itens, sem mexer nas outras marcas; avisa quantos mudaram. */
  const setProtected = useCallback(async (ids: string[], value: boolean, what: 'favorito' | 'pasta' = 'favorito') => {
    if (busy || ids.length === 0) return
    setBusy(true)
    try {
      const prev = await marksStore.get(ids)
      const toPut: ItemMark[] = []
      const toRemove: string[] = []
      ids.forEach((id, i) => {
        const next = patchMark(prev[i], id, { naoMexer: value })
        if (next) toPut.push(next)
        else toRemove.push(id)
      })
      if (toPut.length > 0) await marksStore.put(toPut)
      if (toRemove.length > 0) await marksStore.remove(toRemove)
      setMarks((m) => {
        const copy = new Map(m)
        for (const mark of toPut) copy.set(mark.id, mark)
        for (const id of toRemove) copy.delete(id)
        return copy
      })
      notify(protectMessage(ids.length, value, what))
    } catch (e) {
      notify(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [busy])

  return { tree, marks, setProtected, reload, move, trash, createFolder, undo, lastInfo, toast, dismissToast: () => setToast(null), notify, busy }
}
