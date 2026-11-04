import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { listEntries, saveEntry } from '../../src/storage/journal'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const entry = (planId: string, appliedAt: number) => ({ planId, label: planId, appliedAt, snapshotId: 's', inverse: [] })

describe('listEntries', () => {
  it('do mais recente para o mais antigo, respeitando o limite', async () => {
    await saveEntry(entry('a', 10))
    await saveEntry(entry('c', 30))
    await saveEntry(entry('b', 20))
    expect((await listEntries(5)).map((e) => e.planId)).toEqual(['c', 'b', 'a'])
    expect((await listEntries(2)).map((e) => e.planId)).toEqual(['c', 'b'])
    expect(await listEntries(0)).toEqual([])
  })
})
