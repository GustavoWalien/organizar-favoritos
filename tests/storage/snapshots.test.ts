import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSnapshot } from '../../src/core/snapshot'
import { getSnapshot, latestAutoSnapshot, listSnapshots, pruneSnapshots, saveSnapshot } from '../../src/storage/snapshots'

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

  it('prune remove só os automáticos além de 20 e mantém todos os manuais', async () => {
    for (let t = 1; t <= 3; t++) await saveSnapshot(createSnapshot([], 'm', t, 'manual'))
    for (let t = 10; t <= 34; t++) await saveSnapshot(snap(t))
    const list = await listSnapshots()
    expect(list.filter((s) => s.kind === 'manual')).toHaveLength(3)
    expect(list.filter((s) => s.kind !== 'manual')).toHaveLength(20)
  })

  it('um snapshot antigo sem kind conta como automático ao podar', async () => {
    const legacy = { ...snap(1), kind: undefined }
    await saveSnapshot(legacy)
    for (let t = 10; t <= 30; t++) await saveSnapshot(snap(t))
    expect(await getSnapshot(legacy.id)).toBeUndefined()
  })

  it('latestAutoSnapshot devolve o automático mais recente e ignora os manuais', async () => {
    await saveSnapshot(snap(5))
    await saveSnapshot(createSnapshot([], 'm', 9, 'manual'))
    expect((await latestAutoSnapshot())?.createdAt).toBe(5)
  })

  it('latestAutoSnapshot devolve undefined quando não há nenhum', async () => {
    expect(await latestAutoSnapshot()).toBeUndefined()
  })
})
