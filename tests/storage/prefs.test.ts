import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from '../../src/chrome/localStore'
import {
  loadCleanupPrefs,
  loadLastExportAt,
  loadLinkCheck,
  markExported,
  saveCleanupPrefs,
  saveLinkCheck,
} from '../../src/storage/prefs'

const memStore = (init: Record<string, unknown> = {}): KeyValueStore & { data: Map<string, unknown> } => {
  const data = new Map(Object.entries(init))
  return {
    data,
    get: async (k) => data.get(k),
    set: async (k, v) => { data.set(k, v) },
  }
}

describe('prefs', () => {
  it('padrões com o armazenamento vazio', async () => {
    const s = memStore()
    expect(await loadCleanupPrefs(s)).toEqual({ inactiveDays: 365, keepPolicy: 'antiga' })
    expect(await loadLastExportAt(s)).toBeNull()
    expect(await loadLinkCheck(s)).toBeNull()
  })

  it('valores inválidos voltam ao padrão sem lançar', async () => {
    for (const bad of ['abc', -5, 0, 1.5, null, {}]) {
      expect((await loadCleanupPrefs(memStore({ inactiveDays: bad }))).inactiveDays, String(bad)).toBe(365)
    }
    expect((await loadCleanupPrefs(memStore({ keepPolicy: 'x' }))).keepPolicy).toBe('antiga')
    expect(await loadLastExportAt(memStore({ lastExportAt: 'ontem' }))).toBeNull()
    expect(await loadLinkCheck(memStore({ linkCheck: { checkedAt: 1 } }))).toBeNull()
    expect(await loadLinkCheck(memStore({ linkCheck: 'lixo' }))).toBeNull()
    expect(await loadLinkCheck(memStore({ linkCheck: { checkedAt: 'x', complete: true, results: {} } }))).toBeNull()
  })

  it('status desconhecido descarta só aquela entrada', async () => {
    const s = memStore({ linkCheck: { checkedAt: 5, complete: true, results: { 'https://a.example': 'ok', 'https://b.example': 'talvez' } } })
    expect(await loadLinkCheck(s)).toEqual({ checkedAt: 5, complete: true, results: { 'https://a.example': 'ok' } })
  })

  it('armazenamento que lança: padrões', async () => {
    const broken: KeyValueStore = { get: async () => { throw new Error('x') }, set: async () => {} }
    expect(await loadCleanupPrefs(broken)).toEqual({ inactiveDays: 365, keepPolicy: 'antiga' })
    expect(await loadLinkCheck(broken)).toBeNull()
    expect(await loadLastExportAt(broken)).toBeNull()
  })

  it('ida e volta', async () => {
    const s = memStore()
    const rec = { checkedAt: 9, complete: false, results: { 'https://a.example': 'quebrado' as const } }
    await saveLinkCheck(rec, s)
    expect(await loadLinkCheck(s)).toEqual(rec)
    await markExported(1234, s)
    expect(await loadLastExportAt(s)).toBe(1234)
    await saveCleanupPrefs({ inactiveDays: 180 }, s)
    await saveCleanupPrefs({ keepPolicy: 'usada' }, s)
    expect(await loadCleanupPrefs(s)).toEqual({ inactiveDays: 180, keepPolicy: 'usada' })
  })
})
