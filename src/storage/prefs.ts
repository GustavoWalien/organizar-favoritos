import { chromeLocalStore, type KeyValueStore } from '../chrome/localStore'
import type { KeepPolicy } from '../core/duplicates'
import type { LinkCheckRecord } from '../core/linkCheckRecord'
import type { LinkStatus } from '../core/linkStatus'

export type { KeepPolicy } from '../core/duplicates'

export interface CleanupPrefs {
  inactiveDays: number
  keepPolicy: KeepPolicy
}

export const DEFAULT_CLEANUP_PREFS: CleanupPrefs = { inactiveDays: 365, keepPolicy: 'antiga' }
const POLICIES: readonly KeepPolicy[] = ['antiga', 'especifica', 'usada']
const STATUSES: readonly LinkStatus[] = ['ok', 'quebrado', 'incerto']

/** Lê uma chave; armazenamento que falha conta como vazio. */
async function read(store: KeyValueStore, key: string): Promise<unknown> {
  try {
    return await store.get(key)
  } catch {
    return undefined
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

export async function loadLinkCheck(store: KeyValueStore = chromeLocalStore): Promise<LinkCheckRecord | null> {
  const v = await read(store, 'linkCheck')
  if (!isObject(v) || !isTime(v.checkedAt) || typeof v.complete !== 'boolean' || !isObject(v.results)) return null
  const results: Record<string, LinkStatus> = {}
  for (const [k, s] of Object.entries(v.results)) {
    const status = STATUSES.find((x) => x === s)
    if (status) results[k] = status
  }
  return { checkedAt: v.checkedAt, complete: v.complete, results }
}

export async function saveLinkCheck(rec: LinkCheckRecord, store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set('linkCheck', rec)
}

export async function loadLastExportAt(store: KeyValueStore = chromeLocalStore): Promise<number | null> {
  const v = await read(store, 'lastExportAt')
  return isTime(v) ? v : null
}

export async function markExported(now: number, store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set('lastExportAt', now)
}

export async function loadCleanupPrefs(store: KeyValueStore = chromeLocalStore): Promise<CleanupPrefs> {
  const days = await read(store, 'inactiveDays')
  const policy = await read(store, 'keepPolicy')
  return {
    inactiveDays: typeof days === 'number' && Number.isInteger(days) && days > 0 ? days : DEFAULT_CLEANUP_PREFS.inactiveDays,
    keepPolicy: POLICIES.find((p) => p === policy) ?? DEFAULT_CLEANUP_PREFS.keepPolicy,
  }
}

export async function saveCleanupPrefs(patch: Partial<CleanupPrefs>, store: KeyValueStore = chromeLocalStore): Promise<void> {
  if (patch.inactiveDays !== undefined) await store.set('inactiveDays', patch.inactiveDays)
  if (patch.keepPolicy !== undefined) await store.set('keepPolicy', patch.keepPolicy)
}
