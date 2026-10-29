import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_WINDOW_MS } from '../../src/core/backupPolicy'
import { BackupFailedError, runPlan, undoLast } from '../../src/core/plan'
import { listSnapshots } from '../../src/storage/snapshots'
import type { BmFolder, JournalEntry, Plan, Snapshot } from '../../src/core/types'
import { makeFakeApi } from '../fixtures/fakeApi'
import { sampleTree } from '../fixtures/sampleTree'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

const plan = (operations: Plan['operations'], id = 'p1'): Plan => ({ id, label: 'Teste', operations })

describe('runPlan', () => {
  it('grava o snapshot antes de mudar qualquer coisa', async () => {
    const log: string[] = []
    const api = makeFakeApi(sampleTree, log)
    const store = {
      saveSnapshot: async (s: Snapshot) => { log.push(`snapshot ${s.reason}`) },
      saveEntry: async (_e: JournalEntry) => { log.push('journal') },
    }
    await runPlan(plan([{ op: 'move', id: '10', toParentId: '2' }]), api, 1, store)
    expect(log).toEqual(['snapshot Teste', 'move 10 2', 'journal'])
  })

  it('se o backup falha, lança BackupFailedError e não aplica nada', async () => {
    const api = makeFakeApi(sampleTree)
    const store = {
      saveSnapshot: async () => { throw new Error('cota estourada') },
      saveEntry: async () => {},
    }
    await expect(runPlan(plan([{ op: 'move', id: '10', toParentId: '2' }]), api, 1, store)).rejects.toBeInstanceOf(BackupFailedError)
    expect(api.calls).toEqual([])
  })

  it('resolve o tempId de uma pasta nova para mover um link para dentro dela', async () => {
    const api = makeFakeApi(sampleTree)
    const r = await runPlan(plan([
      { op: 'create-folder', tempId: 't1', parentId: '2', title: 'Nova' },
      { op: 'move', id: '10', toParentId: 't1' },
    ]), api, 1)
    expect(r.failed).toEqual([])
    const outros = (await api.get('2')) as BmFolder
    const nova = outros.children.find((c) => c.title === 'Nova') as BmFolder
    expect(nova.children.map((c) => c.id)).toEqual(['10'])
  })

  it('operação sobre id inexistente falha sozinha e as outras seguem', async () => {
    const api = makeFakeApi(sampleTree)
    const r = await runPlan(plan([
      { op: 'move', id: '999', toParentId: '2' },
      { op: 'move', id: '10', toParentId: '2' },
    ]), api, 1)
    expect(r.failed).toHaveLength(1)
    expect(r.failed[0]?.op).toMatchObject({ id: '999' })
    expect(r.applied).toBe(1)
    expect((await api.get('10'))?.parentId).toBe('2')
  })

  it('recusa mover ou remover uma pasta raiz', async () => {
    const api = makeFakeApi(sampleTree)
    const r = await runPlan(plan([
      { op: 'move', id: '1', toParentId: '2' },
      { op: 'remove', id: '3' },
    ]), api, 1)
    expect(r.applied).toBe(0)
    expect(r.failed.map((f) => f.error)).toEqual([expect.stringContaining('protegida'), expect.stringContaining('protegida')])
    expect(api.calls).toEqual([])
  })

  it('um plano só com remove não deixa entrada no diário', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(plan([{ op: 'remove', id: '20' }]), api, 1)
    expect(await undoLast(api)).toBeNull()
  })
})

describe('undoLast', () => {
  it('devolve cada link ao pai e ao índice originais', async () => {
    const api = makeFakeApi(sampleTree)
    const before = await api.getTree()
    await runPlan(plan([
      { op: 'create-folder', tempId: 't1', parentId: '2', title: 'Nova' },
      { op: 'move', id: '10', toParentId: 't1' },
      { op: 'move', id: '11', toParentId: '2', toIndex: 0 },
    ]), api, 1)
    expect(await api.getTree()).not.toEqual(before)
    const r = await undoLast(api)
    expect(r).toEqual({ undone: 3, skipped: 0, relocated: 0 })
    expect(await api.getTree()).toEqual(before)
  })

  it('só desfaz o que foi aplicado quando houve falha parcial', async () => {
    const api = makeFakeApi(sampleTree)
    const before = await api.getTree()
    await runPlan(plan([
      { op: 'move', id: '999', toParentId: '2' },
      { op: 'move', id: '10', toParentId: '2' },
    ]), api, 1)
    expect(await undoLast(api)).toEqual({ undone: 1, skipped: 0, relocated: 0 })
    expect(await api.getTree()).toEqual(before)
  })

  it('não apaga uma pasta criada pelo plano que depois ganhou conteúdo', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(plan([{ op: 'create-folder', tempId: 't1', parentId: '2', title: 'Nova' }]), api, 1)
    const outros = (await api.get('2')) as BmFolder
    const nova = outros.children.find((c) => c.title === 'Nova')!
    await api.move('11', nova.id)
    expect(await undoLast(api)).toEqual({ undone: 0, skipped: 1, relocated: 0 })
    expect(await api.get(nova.id)).toBeDefined()
  })

  it('desfaz o plano mais recente primeiro e apaga a entrada usada', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(plan([{ op: 'move', id: '10', toParentId: '2' }], 'a'), api, 1)
    await runPlan(plan([{ op: 'move', id: '11', toParentId: '2' }], 'b'), api, 2)
    await undoLast(api)
    expect((await api.get('11'))?.parentId).toBe('5')
    expect((await api.get('10'))?.parentId).toBe('2')
    await undoLast(api)
    expect((await api.get('10'))?.parentId).toBe('5')
    expect(await undoLast(api)).toBeNull()
  })

  it('se o índice original não existe mais, tenta de novo sem índice', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(plan([{ op: 'move', id: '11', toParentId: '2' }]), api, 1)
    await api.remove('10') // a pasta Dev agora está vazia: o índice 1 não existe mais
    expect(await undoLast(api)).toEqual({ undone: 1, skipped: 0, relocated: 0 })
    expect((await api.get('11'))?.parentId).toBe('5')
  })

  it('se a pasta de origem sumiu, manda para Outros favoritos e ainda remove a Lixeira vazia', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(plan([
      { op: 'create-folder', tempId: 't', parentId: '2', title: 'Lixeira' },
      { op: 'move', id: '11', toParentId: 't' },
    ]), api, 1)
    await api.remove('5') // a pasta Dev some
    expect(await undoLast(api)).toEqual({ undone: 2, skipped: 0, relocated: 1 })
    expect((await api.get('11'))?.parentId).toBe('2')
    const outros = (await api.get('2')) as BmFolder
    expect(outros.children.some((c) => c.kind === 'folder' && c.title === 'Lixeira')).toBe(false)
  })

  it('devolve null sem diário', async () => {
    expect(await undoLast(makeFakeApi(sampleTree))).toBeNull()
  })
})

describe('runPlan com backup compartilhado', () => {
  const move = (id: string, planId: string): Plan => plan([{ op: 'move', id, toParentId: '2' }], planId)

  it('dois planos com shareBackup dentro da janela geram um snapshot só e o mesmo snapshotId', async () => {
    const api = makeFakeApi(sampleTree)
    const a = await runPlan(move('10', 'a'), api, 1_000, undefined, { shareBackup: true })
    const b = await runPlan(move('11', 'b'), api, 61_000, undefined, { shareBackup: true })
    expect(await listSnapshots()).toHaveLength(1)
    expect(b.entry.snapshotId).toBe(a.entry.snapshotId)
  })

  it('depois da janela, shareBackup gera um novo snapshot', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(move('10', 'a'), api, 1_000, undefined, { shareBackup: true })
    await runPlan(move('11', 'b'), api, 1_000 + BACKUP_WINDOW_MS, undefined, { shareBackup: true })
    expect(await listSnapshots()).toHaveLength(2)
  })

  it('sem shareBackup (limpeza, restauração), sempre faz backup novo mesmo dentro da janela', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(move('10', 'a'), api, 1_000, undefined, { shareBackup: true })
    await runPlan(move('11', 'b'), api, 2_000)
    expect(await listSnapshots()).toHaveLength(2)
  })

  it('com shareBackup e janela fechada, se o snapshot novo falha, lança BackupFailedError e não aplica nada', async () => {
    const api = makeFakeApi(sampleTree)
    const store = {
      saveSnapshot: async () => { throw new Error('cota estourada') },
      saveEntry: async () => {},
      latestAutoSnapshot: async () => undefined,
    }
    await expect(runPlan(move('10', 'a'), api, 1, store, { shareBackup: true })).rejects.toBeInstanceOf(BackupFailedError)
    expect(api.calls).toEqual([])
  })

  it('o desfazer continua sendo por plano, mesmo com o backup compartilhado', async () => {
    const api = makeFakeApi(sampleTree)
    await runPlan(move('10', 'a'), api, 1_000, undefined, { shareBackup: true })
    await runPlan(move('11', 'b'), api, 2_000, undefined, { shareBackup: true })
    await undoLast(api)
    expect((await api.get('11'))?.parentId).toBe('5')
    expect((await api.get('10'))?.parentId).toBe('2')
  })
})
