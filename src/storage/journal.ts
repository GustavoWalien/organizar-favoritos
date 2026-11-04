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

/** As `limit` entradas mais recentes, da mais nova para a mais antiga. */
export async function listEntries(limit: number): Promise<JournalEntry[]> {
  const all = await withDb((db) => db.getAll('journal') as Promise<JournalEntry[]>)
  return all.sort((a, b) => b.appliedAt - a.appliedAt).slice(0, Math.max(0, limit))
}
