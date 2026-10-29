import type { Snapshot } from './types'

/** Planos de "mover favoritos" em sequência compartilham o mesmo backup automático dentro desta janela. */
export const BACKUP_WINDOW_MS = 600_000

export function canShareBackup(last: Snapshot | undefined, now: number): boolean {
  if (!last || last.kind === 'manual') return false
  const age = now - last.createdAt
  return age >= 0 && age < BACKUP_WINDOW_MS
}
