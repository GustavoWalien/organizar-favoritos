import { chromeBookmarksApi } from '../chrome/bookmarksApi'
import { createSnapshot } from '../core/snapshot'
import type { Snapshot } from '../core/types'
import { marksStore } from '../storage/flags'
import { saveSnapshot } from '../storage/snapshots'

/** Backup manual da árvore atual. */
export async function makeBackup(reason = 'Backup manual'): Promise<Snapshot> {
  const flags = await marksStore.all()
  const snapshot = createSnapshot(await chromeBookmarksApi.getTree(), reason, Date.now(), 'manual', flags)
  await saveSnapshot(snapshot)
  return snapshot
}
