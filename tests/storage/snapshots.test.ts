import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSnapshot } from '../../src/core/snapshot'
import { getSnapshot, listSnapshots, pruneSnapshots, saveSnapshot } from '../../src/storage/snapshots'

const snap = (t: number) => createSnapshot([], `t${t}`, t)

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

describe('snapshots', () => {
  it('guarda e lista do mais novo para o mais antigo', async () => {
    for (const t of [1, 3, 2]) await saveSnapshot(snap(t))
    expect((await listSnapshots()).map((s) => s.createdAt)).toEqual([3, 2, 1])
  })

  it('mantém só os últimos 20, descartando os mais antigos', async () => {
    for (let t = 1; t <= 25; t++) await saveSnapshot(snap(t))
    const list = await listSnapshots()
    expect(list).toHaveLength(20)
    expect(list.at(0)?.createdAt).toBe(25)
    expect(list.at(-1)?.createdAt).toBe(6)
  })

  it('pruneSnapshots aceita outro limite', async () => {
    for (let t = 1; t <= 5; t++) await saveSnapshot(snap(t))
    await pruneSnapshots(2)
    expect((await listSnapshots()).map((s) => s.createdAt)).toEqual([5, 4])
  })

  it('getSnapshot devolve o snapshot salvo e undefined para id inexistente', async () => {
    const s = snap(7)
    await saveSnapshot(s)
    expect(await getSnapshot(s.id)).toEqual(s)
    expect(await getSnapshot('nao-existe')).toBeUndefined()
  })
})
