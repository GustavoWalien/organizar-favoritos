import { describe, expect, it } from 'vitest'
import { runPlan } from '../../src/core/plan'
import { planRestoreAll, planRestoreItem } from '../../src/core/restore'
import { createSnapshot } from '../../src/core/snapshot'
import type { BmFolder, BmNode, Operation } from '../../src/core/types'
import { makeFakeApi, makeFakeMarks } from '../fixtures/fakeApi'
import { sampleTree } from '../fixtures/sampleTree'

const snap = createSnapshot(sampleTree, 'antes', 0)
const now = new Date(2026, 9, 29, 15, 7)

const folder = (tree: BmNode[], id: string) => {
  const walk = (nodes: BmNode[]): BmFolder | undefined => {
    for (const n of nodes) {
      if (n.kind !== 'folder') continue
      if (n.id === id) return n
      const f = walk(n.children)
      if (f) return f
    }
  }
  return walk(tree)!
}

/** Cópia da árvore atual sem os nós indicados (como se tivessem sido apagados). */
const without = (...ids: string[]): BmNode[] => {
  const t = structuredClone(sampleTree)
  const prune = (nodes: BmNode[]): BmNode[] =>
    nodes.filter((n) => !ids.includes(n.id)).map((n) => (n.kind === 'folder' ? { ...n, children: prune(n.children) } : n))
  return prune(t)
}

describe('planRestoreAll', () => {
  const plan = planRestoreAll(snap, sampleTree, now)

  it('só cria pastas e links: nunca toca em favoritos existentes', () => {
    expect(plan.operations.every((o) => o.op === 'create-folder' || o.op === 'create-link')).toBe(true)
  })

  it('a primeira operação cria a pasta Restaurado em <data> dentro de Outros favoritos', () => {
    expect(plan.operations[0]).toMatchObject({ op: 'create-folder', title: 'Restaurado em 2026-10-29 15:07', parentId: '2' })
  })

  it('recria a árvore inteira, com os links ligados às pastas certas', () => {
    const folders = plan.operations.filter((o): o is Extract<Operation, { op: 'create-folder' }> => o.op === 'create-folder')
    const byTitle = (t: string) => folders.find((f) => f.title === t)!
    expect(folders.map((f) => f.title)).toEqual([
      'Restaurado em 2026-10-29 15:07', 'Barra de favoritos', 'Dev', 'Outros favoritos', 'Favoritos para dispositivos móveis',
    ])
    expect(byTitle('Dev').parentId).toBe(byTitle('Barra de favoritos').tempId)
    const mdn = plan.operations.find((o) => o.op === 'create-link' && o.title === 'MDN')
    expect(mdn).toMatchObject({ parentId: byTitle('Dev').tempId, url: 'https://developer.mozilla.org/' })
  })

  it('os tempIds são únicos', () => {
    const ids = plan.operations.flatMap((o) => (o.op === 'create-folder' ? [o.tempId] : []))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('planRestoreItem', () => {
  it('um item que está em outra pasta (ex.: Lixeira) volta ao pai original com move', () => {
    const current = structuredClone(without('10'))
    folder(current, '2').children.push({ kind: 'link', id: '10', parentId: '2', title: 'MDN', url: 'https://developer.mozilla.org/', dateAdded: 1 })
    expect(planRestoreItem(snap, '10', current, now).operations).toEqual([{ op: 'move', id: '10', toParentId: '5' }])
  })

  it('um item que já está no lugar não gera operações', () => {
    expect(planRestoreItem(snap, '10', sampleTree, now).operations).toEqual([])
  })

  it('um item apagado é recriado no pai original quando ele ainda existe', () => {
    expect(planRestoreItem(snap, '10', without('10'), now).operations).toEqual([
      { op: 'create-link', parentId: '5', title: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
  })

  it('uma pasta apagada volta com os filhos, no pai original', () => {
    const ops = planRestoreItem(snap, '5', without('5'), now).operations
    expect(ops[0]).toMatchObject({ op: 'create-folder', title: 'Dev', parentId: '1' })
    const temp = (ops[0] as Extract<Operation, { op: 'create-folder' }>).tempId
    expect(ops.slice(1).map((o) => o.op === 'create-link' && o.parentId)).toEqual([temp, temp])
  })

  it('se o pai original também sumiu, cria a pasta Restaurados em Outros favoritos e usa ela', () => {
    const ops = planRestoreItem(snap, '10', without('5'), now).operations
    expect(ops[0]).toMatchObject({ op: 'create-folder', title: 'Restaurados', parentId: '2' })
    const temp = (ops[0] as Extract<Operation, { op: 'create-folder' }>).tempId
    expect(ops[1]).toMatchObject({ op: 'create-link', parentId: temp, title: 'MDN' })
  })

  it('reaproveita a pasta Restaurados quando ela já existe', () => {
    const current = without('5')
    folder(current, '2').children.push({ kind: 'folder', id: '77', parentId: '2', title: 'Restaurados', children: [] })
    expect(planRestoreItem(snap, '10', current, now).operations).toEqual([
      { op: 'create-link', parentId: '77', title: 'MDN', url: 'https://developer.mozilla.org/' },
    ])
  })

  it('recusa um id que não está no backup e as pastas raiz', () => {
    expect(() => planRestoreItem(snap, '999', sampleTree, now)).toThrow('não está')
    expect(() => planRestoreItem(snap, '1', sampleTree, now)).toThrow('raiz')
  })
})

describe('restauração com marcas', () => {
  const snapMarked = createSnapshot(sampleTree, 'antes', 0, 'manual', [
    { id: '10', naoMexer: true },
    { id: '5', sugestao: 'Programação', aprovado: 'sim' },
  ])
  const store = (marks: ReturnType<typeof makeFakeMarks>) => ({ saveSnapshot: async () => {}, saveEntry: async () => {}, marks })

  it('planRestoreAll põe tempId em todo create-link/create-folder e uma PlanMark por marca', () => {
    const p = planRestoreAll(snapMarked, sampleTree, now)
    const temps = p.operations.flatMap((o) => (o.op === 'create-link' || o.op === 'create-folder' ? [o.tempId] : []))
    expect(temps.every((t) => typeof t === 'string')).toBe(true)
    expect(new Set(temps).size).toBe(temps.length)
    const mdn = p.operations.find((o) => o.op === 'create-link' && o.title === 'MDN')
    const dev = p.operations.find((o) => o.op === 'create-folder' && o.title === 'Dev')
    expect(p.marks).toEqual([
      { target: (mdn as { tempId: string }).tempId, patch: { naoMexer: true } },
      { target: (dev as { tempId: string }).tempId, patch: { sugestao: 'Programação', aprovado: 'sim' } },
    ])
  })

  it('executado com runPlan, a marca fica no id novo', async () => {
    const api = makeFakeApi(without('10', '11'))
    const marks = makeFakeMarks()
    const p = planRestoreAll(snapMarked, await api.getTree(), now)
    const r = await runPlan(p, api, 1, store(marks))
    const mdn = p.operations.find((o) => o.op === 'create-link' && o.title === 'MDN') as { tempId: string }
    const newId = r.idMap[mdn.tempId]!
    expect(marks.data.get(newId)).toEqual({ id: newId, naoMexer: true })
    expect(marks.data.has('10')).toBe(false)
  })

  it('planRestoreItem de item apagado recria com tempId e marca no id novo', async () => {
    const api = makeFakeApi(without('10'))
    const marks = makeFakeMarks()
    const p = planRestoreItem(snapMarked, '10', await api.getTree(), now)
    expect(p.operations[0]).toMatchObject({ op: 'create-link', parentId: '5', tempId: expect.any(String) })
    const r = await runPlan(p, api, 1, store(marks))
    const newId = Object.values(r.idMap)[0]!
    expect(marks.data.get(newId)).toEqual({ id: newId, naoMexer: true })
  })

  it('planRestoreItem de pasta apagada leva só as marcas da pasta e dos filhos que estavam nela', () => {
    const p = planRestoreItem(snapMarked, '5', without('5'), now)
    expect(p.marks).toHaveLength(2)
  })

  it('item que ainda existe e só é movido de volta não duplica marca', () => {
    const current = structuredClone(without('10'))
    folder(current, '2').children.push({ kind: 'link', id: '10', parentId: '2', title: 'MDN', url: 'https://developer.mozilla.org/', dateAdded: 1 })
    const p = planRestoreItem(snapMarked, '10', current, now)
    expect(p.operations).toEqual([{ op: 'move', id: '10', toParentId: '5' }])
    expect(p.marks ?? []).toEqual([])
  })

  it('snapshot sem flags restaura como antes, sem marks', () => {
    expect(planRestoreAll(snap, sampleTree, now).marks ?? []).toEqual([])
    expect(planRestoreItem(snap, '10', without('10'), now).marks ?? []).toEqual([])
  })
})
