import { chromeBookmarksApi } from '../chrome/bookmarksApi'
import { createSnapshot } from '../core/snapshot'
import type { Snapshot } from '../core/types'
import { saveSnapshot } from '../storage/snapshots'

/** Backup manual da árvore atual. */
export async function makeBackup(reason = 'Backup manual'): Promise<Snapshot> {
  const snapshot = createSnapshot(await chromeBookmarksApi.getTree(), reason, Date.now(), 'manual')
  await saveSnapshot(snapshot)
  return snapshot
}
