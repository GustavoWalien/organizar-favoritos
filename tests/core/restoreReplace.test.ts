import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { findTrash, TRASH_TITLE } from '../../src/core/cleanup'
import { runPlan, undoLast } from '../../src/core/plan'
import { planRestoreReplace } from '../../src/core/restore'
import { createSnapshot } from '../../src/core/snapshot'
import type { BmFolder, BmNode } from '../../src/core/types'
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
  it('deixa cada raiz exatamente como no backup e manda o que existia para a Lixeira', async () => {
    const api = makeFakeApi(changed())
    const plan = planRestoreReplace(snap, await api.getTree(), now)
    const r = await runPlan(plan, api, 1)
    expect(r.failed).toEqual([])
    const after = await api.getTree()
    for (const id of ['1', '2', '3']) expect(rootShape(after, id, true)).toEqual(rootShape(sampleTree, id))
    const trash = shape(findTrash(after)!.children)
    expect(trash.map((n) => n.t)).toEqual(['Velho', 'Programação', 'Novo', 'Exemplo'])
  })

  it('nunca apaga nada: só move para a Lixeira e cria', async () => {
    const plan = planRestoreReplace(snap, changed(), now)
    expect(plan.operations.every((o) => o.op !== 'remove')).toBe(true)
  })

  it('cria a Lixeira em Outros favoritos quando ela não existe', async () => {
    const api = makeFakeApi(structuredClone(sampleTree))
    const plan = planRestoreReplace(snap, await api.getTree(), now)
    expect(plan.operations[0]).toMatchObject({ op: 'create-folder', parentId: '2', title: TRASH_TITLE })
    await runPlan(plan, api, 1)
    const after = await api.getTree()
    expect(rootShape(after, '1')).toEqual(rootShape(sampleTree, '1'))
    expect(shape(findTrash(after)!.children).map((n) => n.t)).toEqual(['Dev', 'Exemplo'])
  })

  it('não recria a Lixeira que estava no backup', async () => {
    const backup = createSnapshot(changed(), 'com lixeira', 0)
    const api = makeFakeApi(structuredClone(sampleTree))
    await runPlan(planRestoreReplace(backup, await api.getTree(), now), api, 1)
    const other = roots(await api.getTree())[1] as BmFolder
    expect(other.children.filter((c) => c.kind === 'folder' && c.title === TRASH_TITLE)).toHaveLength(1)
  })

  it('o Desfazer volta à árvore de antes', async () => {
    const api = makeFakeApi(changed())
    const before = shape(await api.getTree())
    await runPlan(planRestoreReplace(snap, await api.getTree(), now), api, 1)
    await undoLast(api)
    expect(shape(await api.getTree())).toEqual(before)
  })
})
