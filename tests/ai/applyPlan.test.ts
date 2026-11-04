import { describe, expect, it } from 'vitest'
import { groupByTarget, newFolderKey, planFromProposal, renameNewFolder } from '../../src/ai/applyPlan'
import type { MarksMap } from '../../src/core/marks'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'
import type { Proposal, ProposalItem } from '../../src/storage/aiStore'

const lnk = (id: string, parentId: string): BmLink => ({ kind: 'link', id, parentId, title: id, url: `https://${id}.example/`, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const tree = (): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [dir('10', '1', 'Dev', [lnk('jaLa', '10')]), dir('12', '1', 'Casa'), lnk('a', '1'), lnk('b', '1'), lnk('c', '1'), lnk('d', '1')]),
    dir('2', '0', 'Outros', []),
  ]),
]
const item = (itemId: string, folderId: string, newPath: string[] = [], over: Partial<ProposalItem> = {}): ProposalItem => ({
  itemId, folderId, newPath, confidence: 'alta', reason: 'r', title: itemId, domain: `${itemId}.example`, fromFolderId: '1', source: 'ia', accepted: true, ...over,
})
const prop = (items: ProposalItem[]): Proposal => ({ createdAt: 1, provider: 'anthropic', model: 'm', scope: { kind: 'sem-categoria', allowNew: true }, items, failedBatches: 0, missing: 0 })
const none: MarksMap = new Map()

describe('planFromProposal', () => {
  it('move aceito; recusado e já no lugar não geram nada', () => {
    const r = planFromProposal(prop([item('a', '10'), item('b', '10', [], { accepted: false }), item('jaLa', '10', [], { fromFolderId: '10' })]), tree(), none, 1)
    expect(r.plan.operations).toEqual([{ op: 'move', id: 'a', toParentId: '10' }])
    expect(r.moves).toBe(1)
    expect(r.changed).toBe(0)
    expect(r.plan.label).toBe('Sugestões da IA: 1 favorito')
  })

  it('pasta nova de 2 níveis: pai antes do filho, move para o filho', () => {
    const r = planFromProposal(prop([item('a', '1', ['Finanças', 'Bancos'])]), tree(), none, 1)
    const [f1, f2, mv] = r.plan.operations
    expect(f1).toMatchObject({ op: 'create-folder', parentId: '1', title: 'Finanças' })
    expect(f2).toMatchObject({ op: 'create-folder', title: 'Bancos' })
    expect(f2 && 'parentId' in f2 && f1 && 'tempId' in f1 && f2.parentId === f1.tempId).toBe(true)
    expect(mv).toMatchObject({ op: 'move', id: 'a' })
    expect(mv && 'toParentId' in mv && f2 && 'tempId' in f2 && mv.toParentId === f2.tempId).toBe(true)
    expect(r.newFolders).toBe(2)
  })

  it('mesma pasta nova com grafias diferentes vira uma só', () => {
    const r = planFromProposal(prop([item('a', '1', ['Finanças']), item('b', '1', ['financas'])]), tree(), none, 1)
    const creates = r.plan.operations.filter((o) => o.op === 'create-folder')
    expect(creates).toHaveLength(1)
    expect(creates[0]).toMatchObject({ title: 'Finanças' })
    expect(r.moves).toBe(2)
    expect(newFolderKey('1', ['Finanças'])).toBe(newFolderKey('1', ['  FINANCAS ']))
  })

  it('árvore mudou: fica de fora e conta', () => {
    const t = tree()
    const marks: MarksMap = new Map([['c', { id: 'c', naoMexer: true }], ['12', { id: '12', naoMexer: true }]])
    const items = [
      item('sumiu', '10'),
      item('b', '10', [], { fromFolderId: '99' }), // mudou de pasta desde a sugestão
      item('c', '10'), // ganhou "não mexer"
      item('d', '12'), // destino ganhou "não mexer"
      item('a', '77'), // destino sumiu
    ]
    const r = planFromProposal(prop(items), t, marks, 1)
    expect(r.plan.operations).toEqual([])
    expect(r.changed).toBe(5)
  })

  it('pasta nova não é criada se nenhum item aceito vai para ela', () => {
    const r = planFromProposal(prop([item('a', '1', ['X'], { accepted: false })]), tree(), none, 1)
    expect(r.plan.operations).toEqual([])
  })
})

describe('renameNewFolder e groupByTarget', () => {
  it('renomeia o último nome em todo o grupo', () => {
    const p = renameNewFolder(prop([item('a', '1', ['Fin']), item('b', '1', ['Fin']), item('c', '1', ['Outra'])]), '1', ['Fin'], 'Finanças', tree())
    expect(p.items.map((i) => i.newPath)).toEqual([['Finanças'], ['Finanças'], ['Outra']])
  })

  it('nome que coincide com pasta irmã existente junta com ela', () => {
    const p = renameNewFolder(prop([item('a', '1', ['Lar'])]), '1', ['Lar'], 'casa', tree())
    expect(p.items[0]).toMatchObject({ folderId: '12', newPath: [] })
    const g = groupByTarget(p, tree())
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ folderId: '12', isNew: false, label: 'Barra › Casa' })
  })

  it('agrupa por destino, ordena pelo rótulo, marca nova', () => {
    const g = groupByTarget(prop([item('a', '10'), item('b', '1', ['Finanças']), item('c', '1', ['finanças']), item('d', '10')]), tree())
    expect(g.map((x) => [x.label, x.isNew, x.items.map((i) => i.itemId)])).toEqual([
      ['Barra › Dev', false, ['a', 'd']],
      ['Barra › Finanças', true, ['b', 'c']],
    ])
  })
})
