import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { findTrash, TRASH_TITLE } from '../../src/core/cleanup'
import { runPlan } from '../../src/core/plan'
import { planRestoreReplace } from '../../src/core/restore'
import { createSnapshot } from '../../src/core/snapshot'
import type { BmFolder, BmNode } from '../../src/core/types'
import { lastEntry, saveEntry } from '../../src/storage/journal'
import { listSnapshots } from '../../src/storage/snapshots'
import { makeFakeApi } from '../fixtures/fakeApi'
import { sampleTree } from '../fixtures/sampleTree'

const now = new Date(2026, 10, 5, 16, 0)

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

/** Forma da árvore sem ids nem datas: títulos, URLs e aninhamento. */
type Shape = { t: string; u?: string; c?: Shape[] }
const shape = (nodes: BmNode[]): Shape[] =>
  nodes.map((n) => (n.kind === 'link' ? { t: n.title, u: n.url } : { t: n.title, c: shape(n.children) }))
const roots = (tree: BmNode[]) => (tree[0] as BmFolder).children
const rootShape = (tree: BmNode[], id: string, skipTrash = false) =>
  shape((roots(tree).find((r) => r.id === id) as BmFolder).children.filter((c) => !(skipTrash && c.kind === 'folder' && c.title === TRASH_TITLE)))

/** Árvore "depois da IA": Dev renomeado para Programação, link novo na Barra, Lixeira com um item antigo. */
const changed = (): BmNode[] => {
  const t = structuredClone(sampleTree)
  const bar = roots(t)[0] as BmFolder
  ;(bar.children[0] as BmFolder).title = 'Programação'
  bar.children.push({ kind: 'link', id: '12', parentId: '1', title: 'Novo', url: 'https://novo.example/', dateAdded: 0 })
  const other = roots(t)[1] as BmFolder
  other.children.push({ kind: 'folder', id: '30', parentId: '2', title: TRASH_TITLE, children: [
    { kind: 'link', id: '31', parentId: '30', title: 'Velho', url: 'https://velho.example/', dateAdded: 0 },
  ] })
  return t
}

const snap = createSnapshot(sampleTree, 'antes', 0)

describe('planRestoreReplace', () => {
  it('deixa cada raiz exatamente como no backup, sem levar nada para a Lixeira', async () => {
    const api = makeFakeApi(changed())
    const r = await runPlan(planRestoreReplace(snap, await api.getTree(), now), api, 1, undefined, { noUndo: true })
    expect(r.failed).toEqual([])
    const after = await api.getTree()
    for (const id of ['1', '2', '3']) expect(rootShape(after, id, true)).toEqual(rootShape(sampleTree, id))
    expect(shape(findTrash(after)!.children).map((n) => n.t)).toEqual(['Velho'])
  })

  it('a Lixeira atual não é apagada', () => {
    const plan = planRestoreReplace(snap, changed(), now)
    expect(plan.operations).not.toContainEqual({ op: 'remove', id: '30' })
  })

  it('não recria a Lixeira que estava no backup', async () => {
    const backup = createSnapshot(changed(), 'com lixeira', 0)
    const api = makeFakeApi(structuredClone(sampleTree))
    await runPlan(planRestoreReplace(backup, await api.getTree(), now), api, 1, undefined, { noUndo: true })
    const other = roots(await api.getTree())[1] as BmFolder
    expect(other.children.filter((c) => c.kind === 'folder' && c.title === TRASH_TITLE)).toHaveLength(0)
  })

  it('o backup automático feito antes guarda a árvore de antes, e o plano não entra no Desfazer', async () => {
    const api = makeFakeApi(changed())
    const before = shape(await api.getTree())
    await saveEntry({ planId: 'anterior', label: 'x', appliedAt: 0, snapshotId: 's', inverse: [] })
    await runPlan(planRestoreReplace(snap, await api.getTree(), now), api, 1, undefined, { noUndo: true })
    const [auto] = await listSnapshots()
    expect(shape(auto!.tree)).toEqual(before)
    expect((await lastEntry())?.planId).toBe('anterior')
  })
})
