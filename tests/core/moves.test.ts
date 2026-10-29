import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import { describeMove, moveLinks, planMoveLinks } from '../../src/core/moves'
import { undoLast } from '../../src/core/plan'
import type { BmFolder, BmNode } from '../../src/core/types'
import { makeFakeApi } from '../fixtures/fakeApi'
import { sampleTree } from '../fixtures/sampleTree'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
})

/** sampleTree + pasta 'Lazer' (id 6) e Lixeira (id 50) dentro de Outros. */
const tree = (): BmNode[] => {
  const t = structuredClone(sampleTree)
  const outros = (t[0] as BmFolder).children.find((c) => c.id === '2') as BmFolder
  outros.children.push(
    { kind: 'folder', id: '6', parentId: '2', title: 'Lazer', children: [] },
    { kind: 'folder', id: '50', parentId: '2', title: TRASH_TITLE, children: [] },
  )
  return t
}

describe('planMoveLinks', () => {
  it('gera um move por link, na ordem recebida', () => {
    const p = planMoveLinks(tree(), ['11', '10'], '6')
    expect(p.operations).toEqual([
      { op: 'move', id: '11', toParentId: '6' },
      { op: 'move', id: '10', toParentId: '6' },
    ])
  })

  it('ignora link que já está no destino, ids repetidos, ids de pastas e ids que não existem', () => {
    const p = planMoveLinks(tree(), ['20', '10', '10', '5', '999'], '2')
    expect(p.operations).toEqual([{ op: 'move', id: '10', toParentId: '2' }])
  })

  it('soltar na pasta de origem não gera operações', () => {
    expect(planMoveLinks(tree(), ['10', '11'], '5').operations).toEqual([])
  })

  it('o destino pode ser uma pasta raiz ou a Lixeira', () => {
    expect(planMoveLinks(tree(), ['10'], '1').operations).toHaveLength(1)
    expect(planMoveLinks(tree(), ['10'], '50').operations).toHaveLength(1)
  })

  it('destino que não existe ou é um link devolve plano vazio', () => {
    expect(planMoveLinks(tree(), ['10'], '999').operations).toEqual([])
    expect(planMoveLinks(tree(), ['10'], '20').operations).toEqual([])
  })

  it('cada plano tem um id próprio', () => {
    expect(planMoveLinks(tree(), ['10'], '6').id).not.toBe(planMoveLinks(tree(), ['10'], '6').id)
  })
})

describe('moveLinks', () => {
  it('move usando a árvore de agora: um link apagado fora do painel é ignorado e os outros movem', async () => {
    const api = makeFakeApi(tree())
    await api.remove('11')
    const r = await moveLinks(api, ['10', '11', '20'], '6', 1_000)
    expect(r).toMatchObject({ moved: 2, skipped: 1, failed: 0, targetTitle: 'Lazer' })
    expect((await api.get('10'))?.parentId).toBe('6')
    expect((await api.get('20'))?.parentId).toBe('6')
  })

  it('soltar na pasta de origem não faz nada nem cria backup', async () => {
    const api = makeFakeApi(tree())
    const r = await moveLinks(api, ['10'], '5', 1_000)
    expect(r).toMatchObject({ moved: 0, skipped: 1 })
    expect(api.calls).toEqual([])
  })

  it('moveLinks seguido de undoLast devolve tudo ao lugar', async () => {
    const api = makeFakeApi(tree())
    const before = await api.getTree()
    await moveLinks(api, ['10', '11'], '6', 1_000)
    expect(await undoLast(api)).toMatchObject({ undone: 2, skipped: 0 })
    expect(await api.getTree()).toEqual(before)
  })

  it('dois movimentos seguidos compartilham o backup', async () => {
    const api = makeFakeApi(tree())
    await moveLinks(api, ['10'], '6', 1_000)
    await moveLinks(api, ['11'], '6', 61_000)
    const { listSnapshots } = await import('../../src/storage/snapshots')
    expect(await listSnapshots()).toHaveLength(1)
  })
})

describe('describeMove', () => {
  it('singular e plural', () => {
    expect(describeMove({ moved: 1, skipped: 0, failed: 0, targetTitle: 'Lazer' })).toBe('1 favorito movido para "Lazer"')
    expect(describeMove({ moved: 3, skipped: 0, failed: 0, targetTitle: 'Lazer' })).toBe('3 favoritos movidos para "Lazer"')
  })
  it('avisa quando alguns não foram movidos', () => {
    expect(describeMove({ moved: 2, skipped: 1, failed: 1, targetTitle: 'Lazer' })).toBe('2 favoritos movidos para "Lazer" (2 não foram movidos)')
  })
  it('quando tudo falhou, diz quantos não foram movidos', () => {
    expect(describeMove({ moved: 0, skipped: 0, failed: 2, targetTitle: 'Lazer' })).toBe('Não foi possível mover 2 favoritos para "Lazer"')
  })
  it('quando nada mudou, explica', () => {
    expect(describeMove({ moved: 0, skipped: 2, failed: 0, targetTitle: 'Lazer' })).toBe('Nada para mover: os favoritos já estão em "Lazer" ou mudaram')
  })
})
