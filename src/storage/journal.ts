import type { JournalEntry } from '../core/types'
import { withDb } from './db'

export async function saveEntry(e: JournalEntry): Promise<void> {
  await withDb((db) => db.put('journal', e))
}

/** A entrada aplicada mais recentemente, ou undefined se o diário está vazio. */
export async function lastEntry(): Promise<JournalEntry | undefined> {
  const all = await withDb((db) => db.getAll('journal') as Promise<JournalEntry[]>)
  return all.sort((a, b) => b.appliedAt - a.appliedAt)[0]
}

export async function deleteEntry(planId: string): Promise<void> {
  await withDb((db) => db.delete('journal', planId))
}
