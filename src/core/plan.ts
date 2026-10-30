import { type MarksStore, marksStore } from '../storage/flags'
import { deleteEntry, lastEntry, saveEntry } from '../storage/journal'
import { latestAutoSnapshot, saveSnapshot } from '../storage/snapshots'
import { canShareBackup } from './backupPolicy'
import { type ItemMark, patchMark } from './marks'
import { createSnapshot } from './snapshot'
import { isProtected, otherBookmarksId } from './tree'
import type { BmFolder, BookmarksApi, JournalEntry, Operation, Plan, PlanMark, Snapshot } from './types'

export class BackupFailedError extends Error {
  constructor(cause: unknown) {
    super(`O backup falhou e nada foi alterado: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'BackupFailedError'
  }
}

export interface RunStore {
  saveSnapshot(s: Snapshot): Promise<void>
  saveEntry(e: JournalEntry): Promise<void>
  /** Usado só quando o plano pede para compartilhar o backup. */
  latestAutoSnapshot?(): Promise<Snapshot | undefined>
  /** Onde gravar as `marks` do plano; sem ele, as marcas do plano são ignoradas. */
  marks?: MarksStore
}

export interface RunOptions {
  /** Reaproveita o backup automático feito há menos de 10 minutos em vez de criar outro. */
  shareBackup?: boolean
}

export interface UndoStore {
  lastEntry(): Promise<JournalEntry | undefined>
  deleteEntry(planId: string): Promise<void>
  /** Onde restaurar `marksBefore`; sem ele, as marcas da entrada não são restauradas. */
  marks?: MarksStore
}

export interface RunResult {
  applied: number
  failed: { op: Operation; error: string }[]
  entry: JournalEntry
  /** `tempId` → id real, das pastas e dos links criados. */
  idMap: Record<string, string>
  /** As operações foram aplicadas, mas gravar as marcas falhou (a entrada do diário ainda vale). */
  marksError?: string
}

/** Id único para um plano (o diário usa o id como chave). */
export const newPlanId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Grava as marcas do plano já com ids reais. Um `tempId` do plano que não virou id real (criação falhou)
 * tem a marca ignorada. Devolve o estado anterior das marcas lidas, para o diário.
 */
async function applyMarks(
  plan: Plan,
  realIds: Map<string, string>,
  marks: MarksStore,
): Promise<{ before: NonNullable<JournalEntry['marksBefore']>; error?: string }> {
  const tempIds = new Set(
    plan.operations.flatMap((op) => (op.op === 'create-folder' || op.op === 'create-link') && op.tempId !== undefined ? [op.tempId] : []),
  )
  const resolved: { id: string; patch: PlanMark['patch'] }[] = []
  for (const m of plan.marks ?? []) {
    const id = realIds.get(m.target) ?? (tempIds.has(m.target) ? undefined : m.target)
    if (id !== undefined) resolved.push({ id, patch: m.patch })
  }
  if (resolved.length === 0) return { before: [] }

  const ids = [...new Set(resolved.map((r) => r.id))]
  let prevs: (ItemMark | undefined)[]
  try {
    prevs = await marks.get(ids)
  } catch (e) {
    return { before: [], error: message(e) }
  }
  const before = ids.map((id, i) => ({ id, prev: prevs[i] ?? null }))
  const next = new Map<string, ItemMark | undefined>(ids.map((id, i) => [id, prevs[i]]))
  for (const r of resolved) next.set(r.id, patchMark(next.get(r.id), r.id, r.patch))

  const toPut = [...next.values()].filter((m): m is ItemMark => m !== undefined)
  const toRemove = ids.filter((id) => next.get(id) === undefined)
  try {
    if (toPut.length > 0) await marks.put(toPut)
    if (toRemove.length > 0) await marks.remove(toRemove)
  } catch (e) {
    // Gravação parcial é possível; voltar para `before` no desfazer continua correto.
    return { before, error: message(e) }
  }
  return { before }
}

/** Restaura as marcas de antes do plano. */
async function restoreMarks(before: NonNullable<JournalEntry['marksBefore']>, marks: MarksStore): Promise<void> {
  const toPut = before.flatMap((b) => (b.prev ? [b.prev] : []))
  const toRemove = before.filter((b) => b.prev === null).map((b) => b.id)
  if (toPut.length > 0) await marks.put(toPut)
  if (toRemove.length > 0) await marks.remove(toRemove)
}

/** Plano → backup → aplicar → diário. O backup falhando impede qualquer mudança. */
export async function runPlan(
  plan: Plan,
  api: BookmarksApi,
  now: number,
  store: RunStore = { saveSnapshot, saveEntry, latestAutoSnapshot, marks: marksStore },
  opts: RunOptions = {},
): Promise<RunResult> {
  const tree = await api.getTree()
  const last = opts.shareBackup ? await store.latestAutoSnapshot?.().catch(() => undefined) : undefined
  let snapshotId: string
  if (last && canShareBackup(last, now)) {
    snapshotId = last.id
  } else {
    const snapshot = createSnapshot(tree, plan.label, now)
    try {
      await store.saveSnapshot(snapshot)
    } catch (e) {
      throw new BackupFailedError(e)
    }
    snapshotId = snapshot.id
  }

  const realIds = new Map<string, string>()
  const real = (id: string) => realIds.get(id) ?? id
  const inverse: Operation[] = []
  const failed: RunResult['failed'] = []
  let applied = 0

  for (const op of plan.operations) {
    try {
      if (op.op === 'create-folder') {
        const id = await api.createFolder(real(op.parentId), op.title)
        realIds.set(op.tempId, id)
        inverse.push({ op: 'remove', id })
      } else if (op.op === 'create-link') {
        const id = await api.createLink(real(op.parentId), op.title, op.url)
        if (op.tempId !== undefined) realIds.set(op.tempId, id)
        inverse.push({ op: 'remove', id })
      } else if (op.op === 'move') {
        const id = real(op.id)
        if (isProtected(tree, id)) throw new Error('pasta raiz protegida')
        const node = await api.get(id)
        if (!node || node.parentId === undefined) throw new Error('favorito não encontrado')
        await api.move(id, real(op.toParentId), op.toIndex)
        inverse.push({ op: 'move', id, toParentId: node.parentId, toIndex: node.index })
      } else {
        const id = real(op.id)
        if (isProtected(tree, id)) throw new Error('pasta raiz protegida')
        if (!(await api.get(id))) throw new Error('favorito não encontrado')
        await api.remove(id)
      }
      applied++
    } catch (e) {
      failed.push({ op, error: message(e) })
    }
  }

  const entry: JournalEntry = { planId: plan.id, label: plan.label, appliedAt: now, snapshotId, inverse }
  let marksError: string | undefined
  if (plan.marks?.length && store.marks) {
    const r = await applyMarks(plan, realIds, store.marks)
    if (r.before.length > 0) entry.marksBefore = r.before
    marksError = r.error
  }
  // Um plano sem inverso (só `remove`) e sem marcas não deve esconder o desfazer do plano anterior.
  if (inverse.length > 0 || entry.marksBefore) await store.saveEntry(entry)
  const result: RunResult = { applied, failed, entry, idMap: Object.fromEntries(realIds) }
  if (marksError !== undefined) result.marksError = marksError
  return result
}

/**
 * Reverte o último plano aplicado. Devolve null se não há nada para desfazer.
 * Se o lugar de origem mudou, tenta sem o índice e, se a pasta sumiu, manda o item para "Outros favoritos"
 * (`relocated`), para que nada fique preso na Lixeira.
 */
export async function undoLast(
  api: BookmarksApi,
  store: UndoStore = { lastEntry, deleteEntry, marks: marksStore },
): Promise<{ undone: number; skipped: number; relocated: number } | null> {
  const entry = await store.lastEntry()
  if (!entry) return null

  let undone = 0
  let skipped = 0
  let relocated = 0
  for (const op of [...entry.inverse].reverse()) {
    try {
      if (op.op === 'move') {
        if (!(await api.get(op.id))) throw new Error('sumiu')
        try {
          await api.move(op.id, op.toParentId, op.toIndex)
        } catch {
          try {
            await api.move(op.id, op.toParentId)
          } catch {
            await api.move(op.id, otherBookmarksId(await api.getTree()))
            relocated++
          }
        }
      } else if (op.op === 'remove') {
        const node = await api.get(op.id)
        if (!node) throw new Error('sumiu')
        if (node.kind === 'folder' && (node as BmFolder).children.length > 0) throw new Error('pasta com conteúdo')
        await api.remove(op.id)
      }
      undone++
    } catch {
      skipped++
    }
  }
  // Cada marca restaurada conta como uma mudança desfeita.
  if (entry.marksBefore?.length) {
    const n = entry.marksBefore.length
    try {
      if (!store.marks) throw new Error('sem armazenamento de marcas')
      await restoreMarks(entry.marksBefore, store.marks)
      undone += n
    } catch {
      skipped += n
    }
  }
  await store.deleteEntry(entry.planId)
  return { undone, skipped, relocated }
}

/** Desfaz o plano `planId` só se ele ainda for o mais recente; senão devolve "outdated" e não mexe em nada. */
export async function undoIfLatest(
  api: BookmarksApi,
  planId: string,
  store: UndoStore = { lastEntry, deleteEntry, marks: marksStore },
): Promise<{ undone: number; skipped: number; relocated: number } | 'outdated' | null> {
  const last = await store.lastEntry()
  if (!last) return null
  if (last.planId !== planId) return 'outdated'
  return undoLast(api, store)
}
