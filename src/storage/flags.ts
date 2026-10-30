import type { ItemMark } from '../core/marks'
import { withDb } from './db'

export interface MarksStore {
  all(): Promise<ItemMark[]>
  get(ids: string[]): Promise<(ItemMark | undefined)[]>
  put(marks: ItemMark[]): Promise<void>
  remove(ids: string[]): Promise<void>
}

const STORE = 'flags'

export const marksStore: MarksStore = {
  all: () => withDb((db) => db.getAll(STORE)),

  get: (ids) =>
    withDb(async (db) => {
      const tx = db.transaction(STORE)
      const out = await Promise.all(ids.map((id) => tx.store.get(id) as Promise<ItemMark | undefined>))
      await tx.done
      return out
    }),

  put: (marks) =>
    withDb(async (db) => {
      const tx = db.transaction(STORE, 'readwrite')
      await Promise.all([...marks.map((m) => tx.store.put(m)), tx.done])
    }),

  remove: (ids) =>
    withDb(async (db) => {
      const tx = db.transaction(STORE, 'readwrite')
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
    }),
}
