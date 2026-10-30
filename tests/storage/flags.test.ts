import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSnapshot } from '../../src/core/snapshot'
import { DB_NAME, openDb } from '../../src/storage/db'
import { marksStore } from '../../src/storage/flags'
import { listSnapshots } from '../../src/storage/snapshots'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('marksStore', () => {
  it('put + all ida e volta', async () => {
    await marksStore.put([{ id: '1', naoMexer: true }, { id: '2', sugestao: 'X', aprovado: 'sim' }])
    const all = await marksStore.all()
    expect(all).toHaveLength(2)
    expect(all).toContainEqual({ id: '1', naoMexer: true })
    expect(all).toContainEqual({ id: '2', sugestao: 'X', aprovado: 'sim' })
  })

  it('put substitui a marca do mesmo id', async () => {
    await marksStore.put([{ id: '1', naoMexer: true }])
    await marksStore.put([{ id: '1', sugestao: 'Y' }])
    expect(await marksStore.all()).toEqual([{ id: '1', sugestao: 'Y' }])
  })

  it('get devolve undefined para id ausente, na ordem pedida', async () => {
    await marksStore.put([{ id: '1', naoMexer: true }])
    expect(await marksStore.get(['2', '1'])).toEqual([undefined, { id: '1', naoMexer: true }])
  })

  it('remove apaga', async () => {
    await marksStore.put([{ id: '1', naoMexer: true }, { id: '2', naoMexer: true }])
    await marksStore.remove(['1'])
    expect(await marksStore.all()).toEqual([{ id: '2', naoMexer: true }])
  })
})

describe('migração do banco v1 para v2', () => {
  it('mantém o snapshot e cria o store flags', async () => {
    const old = await openDB(DB_NAME, 1, {
      upgrade(db) {
        const snapshots = db.createObjectStore('snapshots', { keyPath: 'id' })
        snapshots.createIndex('createdAt', 'createdAt')
        db.createObjectStore('journal', { keyPath: 'planId' })
      },
    })
    const snap = createSnapshot([], 'antigo', 5)
    await old.put('snapshots', snap)
    old.close()

    const db = await openDb()
    expect(db.version).toBe(2)
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['flags', 'journal', 'snapshots'])
    db.close()

    expect((await listSnapshots()).map((s) => s.id)).toEqual([snap.id])
    await marksStore.put([{ id: '1', naoMexer: true }])
    expect(await marksStore.all()).toEqual([{ id: '1', naoMexer: true }])
  })
})
