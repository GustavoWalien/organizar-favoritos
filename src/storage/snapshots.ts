import type { Snapshot } from '../core/types'
import { withDb } from './db'

export const MAX_SNAPSHOTS = 20

export async function saveSnapshot(s: Snapshot): Promise<void> {
  await withDb((db) => db.put('snapshots', s))
  await pruneSnapshots(MAX_SNAPSHOTS)
}

/** Do mais novo para o mais antigo. */
export async function listSnapshots(): Promise<Snapshot[]> {
  const all = await withDb((db) => db.getAll('snapshots') as Promise<Snapshot[]>)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getSnapshot(id: string): Promise<Snapshot | undefined> {
  return withDb((db) => db.get('snapshots', id) as Promise<Snapshot | undefined>)
}

export async function pruneSnapshots(max = MAX_SNAPSHOTS): Promise<void> {
  // Só os automáticos são podados; os manuais ficam para sempre.
  const autos = (await listSnapshots()).filter((s) => s.kind !== 'manual')
  await withDb(async (db) => {
    for (const old of autos.slice(max)) await db.delete('snapshots', old.id)
  })
}

/** O backup automático mais recente (para decidir se um novo plano pode compartilhá-lo). */
export async function latestAutoSnapshot(): Promise<Snapshot | undefined> {
  return (await listSnapshots()).find((s) => s.kind !== 'manual')
}
