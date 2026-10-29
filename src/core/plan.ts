import { deleteEntry, lastEntry, saveEntry } from '../storage/journal'
import { latestAutoSnapshot, saveSnapshot } from '../storage/snapshots'
import { canShareBackup } from './backupPolicy'
import { createSnapshot } from './snapshot'
import { isProtected, otherBookmarksId } from './tree'
import type { BmFolder, BookmarksApi, JournalEntry, Operation, Plan, Snapshot } from './types'

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
}

export interface RunOptions {
  /** Reaproveita o backup automático feito há menos de 10 minutos em vez de criar outro. */
  shareBackup?: boolean
}

export interface UndoStore {
  lastEntry(): Promise<JournalEntry | undefined>
  deleteEntry(planId: string): Promise<void>
}

export interface RunResult {
  applied: number
  failed: { op: Operation; error: string }[]
  entry: JournalEntry
}

/** Id único para um plano (o diário usa o id como chave). */
export const newPlanId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Plano → backup → aplicar → diário. O backup falhando impede qualquer mudança. */
export async function runPlan(
  plan: Plan,
  api: BookmarksApi,
  now: number,
  store: RunStore = { saveSnapshot, saveEntry, latestAutoSnapshot },
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
  // Um plano sem inverso (só `remove`) não deve esconder o desfazer do plano anterior.
  if (inverse.length > 0) await store.saveEntry(entry)
  return { applied, failed, entry }
}

/**
 * Reverte o último plano aplicado. Devolve null se não há nada para desfazer.
 * Se o lugar de origem mudou, tenta sem o índice e, se a pasta sumiu, manda o item para "Outros favoritos"
 * (`relocated`), para que nada fique preso na Lixeira.
 */
export async function undoLast(
  api: BookmarksApi,
  store: UndoStore = { lastEntry, deleteEntry },
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
  await store.deleteEntry(entry.planId)
  return { undone, skipped, relocated }
}
