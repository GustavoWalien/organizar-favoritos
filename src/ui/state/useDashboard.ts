import { useCallback, useEffect, useMemo, useState } from 'react'
import { computeDashboard, nextSteps, type Dashboard, type NextStep } from '../../core/dashboard'
import type { LinkCheckRecord } from '../../core/linkCheckRecord'
import type { BmNode, JournalEntry } from '../../core/types'
import { listEntries } from '../../storage/journal'
import {
  DEFAULT_CLEANUP_PREFS,
  loadCleanupPrefs,
  loadLastExportAt,
  loadLinkCheck,
  saveCleanupPrefs,
  saveLinkCheck,
  type CleanupPrefs,
} from '../../storage/prefs'
import { listSnapshots } from '../../storage/snapshots'

export interface DashboardState {
  dashboard: Dashboard | null
  steps: NextStep[]
  lastBackupAt: number | null
  lastExportAt: number | null
  prefs: CleanupPrefs
  linkCheck: LinkCheckRecord | null
  /** As 5 entradas mais recentes do diário. */
  recent: JournalEntry[]
  setPrefs: (patch: Partial<CleanupPrefs>) => Promise<void>
  setLinkCheck: (rec: LinkCheckRecord) => Promise<void>
  /** Lê de novo o armazenamento, os backups e o diário (depois de aplicar, exportar ou desfazer). */
  refresh: () => Promise<void>
}

/** Os números do painel, calculados uma vez por leitura da árvore e compartilhados entre as telas. */
export function useDashboard(tree: BmNode[] | null): DashboardState {
  const [prefs, setPrefsState] = useState<CleanupPrefs>(DEFAULT_CLEANUP_PREFS)
  const [linkCheck, setLinkCheckState] = useState<LinkCheckRecord | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null)
  const [lastExportAt, setLastExportAt] = useState<number | null>(null)
  const [recent, setRecent] = useState<JournalEntry[]>([])

  const refresh = useCallback(async () => {
    const [p, lc, exp, snaps, entries] = await Promise.all([
      loadCleanupPrefs(), loadLinkCheck(), loadLastExportAt(),
      listSnapshots().catch(() => []), listEntries(5).catch(() => []),
    ])
    setPrefsState(p)
    setLinkCheckState(lc)
    setLastExportAt(exp)
    setLastBackupAt(snaps.reduce<number | null>((max, s) => (max === null || s.createdAt > max ? s.createdAt : max), null))
    setRecent(entries)
  }, [])

  // A árvore muda depois de cada plano aplicado ou desfeito: backups e diário também mudaram.
  useEffect(() => { void refresh() }, [tree, refresh])

  const dashboard = useMemo(
    () => (tree ? computeDashboard(tree, { now: Date.now(), inactiveDays: prefs.inactiveDays, keepPolicy: prefs.keepPolicy, linkCheck }) : null),
    [tree, prefs, linkCheck],
  )
  const steps = useMemo(() => (dashboard ? nextSteps(dashboard, lastBackupAt, Date.now()) : []), [dashboard, lastBackupAt])

  const setPrefs = useCallback(async (patch: Partial<CleanupPrefs>) => {
    setPrefsState((p) => ({ ...p, ...patch }))
    await saveCleanupPrefs(patch)
  }, [])
  const setLinkCheck = useCallback(async (rec: LinkCheckRecord) => {
    setLinkCheckState(rec)
    await saveLinkCheck(rec)
  }, [])

  return { dashboard, steps, lastBackupAt, lastExportAt, prefs, linkCheck, recent, setPrefs, setLinkCheck, refresh }
}
