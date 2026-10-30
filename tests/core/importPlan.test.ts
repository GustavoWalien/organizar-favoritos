import { describe, expect, it } from 'vitest'
import { assembleImportPlan, type ImportPreview, planImport } from '../../src/core/importPlan'
import type { ItemMark, MarksMap } from '../../src/core/marks'
import { runPlan, type RunStore } from '../../src/core/plan'
import { exportStructure, parseStructure, type StructureRow } from '../../src/core/structureCsv'
import type { BmFolder, BmNode, Operation } from '../../src/core/types'
import { makeFakeApi, makeFakeMarks } from '../fixtures/fakeApi'
import { sampleTree } from '../fixtures/sampleTree'

const marksOf = (...ms: ItemMark[]): MarksMap => new Map(ms.map((m) => [m.id, m]))
/** CSV → linhas, passando pela exportação e leitura de verdade. */
const csvRows = (tree: BmNode[], marks: MarksMap = new Map()): StructureRow[] => parseStructure(exportStructure(tree, marks)).rows

const link = (id: string, parentId: string, title: string, url: string): BmNode => ({ kind: 'link', id, parentId, title, url, dateAdded: 0 })
const folder = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
/** Árvore com as três raízes; `barra`, `outros` e `mobile` são os filhos de cada uma (`mobile: null` = sem Mobile). */
const browser = (barra: BmNode[] = [], outros: BmNode[] = [], mobile: BmNode[] | null = []): BmNode[] => [
  {
    kind: 'folder', id: '0', title: '', children: [
      folder('1', '0', 'Barra de favoritos', barra),
      folder('2', '0', 'Outros favoritos', outros),
      ...(mobile ? [folder('3', '0', 'Favoritos para dispositivos móveis', mobile)] : []),
    ],
  },
]
const row = (r: Partial<StructureRow>): StructureRow => ({
  tipo: 'link', raiz: 'barra', path: ['Barra de favoritos'], title: 'T', url: 'https://a.example/', ordem: 0,
  naoMexer: false, sugestao: '', aprovado: '', ...r,
})
const kinds = (p: ImportPreview) => p.items.map((i) => `${i.kind} ${i.label}`)
const allKeys = (p: ImportPreview) => new Set(p.items.map((i) => i.key))
const allOps = (p: ImportPreview): Operation[] => p.items.flatMap((i) => i.ops)

/** Estrutura sem ids: pastas como [título, filhos], links como "título url". */
type Shape = string | [string, Shape[]]
const shape = (nodes: BmNode[]): Shape[] => nodes.map((n) => (n.kind === 'link' ? `${n.title} ${n.url}` : [n.title, shape(n.children)]))

const memStore = (marks = makeFakeMarks()): RunStore => ({ saveSnapshot: async () => {}, saveEntry: async () => {}, marks })

describe('planImport', () => {
  it('navegador vazio: cria a pasta Dev e os três links; aplicado, reproduz a árvore original', async () => {
    const empty = browser()
    const preview = planImport(empty, new Map(), csvRows(sampleTree))
    expect(kinds(preview)).toEqual(['criar-pasta Dev', 'criar-link MDN', 'criar-link GitHub', 'criar-link Exemplo'])
    expect(preview.blocked).toEqual([])
    expect(preview.ignored).toEqual([])

    const plan = assembleImportPlan(preview, allKeys(preview), empty, 5)
    const api = makeFakeApi(empty)
    const r = await runPlan(plan, api, 5, memStore())
    expect(r.failed).toEqual([])
    const top = (await api.getTree())[0] as BmFolder
    expect(shape(top.children)).toEqual(shape((sampleTree[0] as BmFolder).children))
  })

  it('idempotência: o CSV exportado da própria árvore não muda nada', () => {
    const marks = marksOf({ id: '5', naoMexer: true }, { id: '20', sugestao: 'Barra de favoritos/Dev', aprovado: 'sim' })
    const preview = planImport(sampleTree, marks, csvRows(sampleTree, marks))
    expect(preview).toEqual({ items: [], blocked: [], ignored: [] })
  })

  it('idempotência com duplicados e pastas de mesmo nome', () => {
    const tree = browser([
      folder('5', '1', 'Dev', [link('10', '5', 'A', 'https://a.example/'), link('11', '5', 'A2', 'https://a.example/')]),
      folder('6', '1', 'Dev', [link('12', '6', 'A3', 'https://a.example/')]),
    ])
    const marks = marksOf({ id: '6', naoMexer: true }, { id: '11', sugestao: 'X' })
    expect(planImport(tree, marks, csvRows(tree, marks))).toEqual({ items: [], blocked: [], ignored: [] })
  })

  it('mover: link único nos dois lados, em outra pasta, vira mover (sem criar)', () => {
    const tree = browser([folder('5', '1', 'Dev')], [link('20', '2', 'Ex', 'https://ex.example/')])
    const rows = [row({ path: ['Barra de favoritos', 'Dev'], title: 'Ex', url: 'https://ex.example' })]
    const preview = planImport(tree, new Map(), rows)
    expect(preview.items.map((i) => i.kind)).toEqual(['mover'])
    expect(preview.items[0]?.ops).toEqual([{ op: 'move', id: '20', toParentId: '5' }])
  })

  it('mover para pasta nova: a pasta entra em needsFolders e o move aponta para o tempId', () => {
    const tree = browser([], [link('20', '2', 'Ex', 'https://ex.example/')])
    const rows = [row({ path: ['Barra de favoritos', 'Nova'], title: 'Ex', url: 'https://ex.example/' })]
    const preview = planImport(tree, new Map(), rows)
    const item = preview.items[0]
    expect(item?.kind).toBe('mover')
    expect(item?.needsFolders).toEqual(['barra|Nova'])
    const plan = assembleImportPlan(preview, allKeys(preview), tree, 1)
    const folderOp = plan.operations[0]
    expect(folderOp).toMatchObject({ op: 'create-folder', parentId: '1', title: 'Nova' })
    expect(plan.operations[1]).toEqual({ op: 'move', id: '20', toParentId: folderOp?.op === 'create-folder' ? folderOp.tempId : '' })
  })

  it('URL repetida no navegador ou no CSV: cria em vez de mover', () => {
    const tree = browser([folder('5', '1', 'Dev')], [link('20', '2', 'Ex', 'https://ex.example/'), link('21', '2', 'Ex2', 'https://ex.example/')])
    const rows = [row({ path: ['Barra de favoritos', 'Dev'], title: 'Ex', url: 'https://ex.example/' })]
    expect(planImport(tree, new Map(), rows).items.map((i) => i.kind)).toEqual(['criar-link'])

    const single = browser([folder('5', '1', 'Dev'), folder('6', '1', 'Web')], [link('20', '2', 'Ex', 'https://ex.example/')])
    const twice = [
      row({ path: ['Barra de favoritos', 'Dev'], title: 'Ex', url: 'https://ex.example/' }),
      row({ path: ['Barra de favoritos', 'Web'], title: 'Ex', url: 'https://ex.example/' }),
    ]
    expect(planImport(single, new Map(), twice).items.map((i) => i.kind)).toEqual(['criar-link', 'criar-link'])
  })

  it('duplicados em pastas diferentes: chaves distintas, cada marca no seu item', () => {
    const rows = [
      row({ path: ['Barra de favoritos', 'A'], tipo: 'pasta', title: 'A', url: '' }),
      row({ path: ['Barra de favoritos', 'A'], title: 'X', url: 'https://x.example/', naoMexer: true }),
      row({ path: ['Barra de favoritos', 'B'], tipo: 'pasta', title: 'B', url: '' }),
      row({ path: ['Barra de favoritos', 'B'], title: 'X', url: 'https://x.example/' }),
    ]
    const preview = planImport(browser(), new Map(), rows)
    const links = preview.items.filter((i) => i.kind === 'criar-link')
    expect(links).toHaveLength(2)
    expect(links[0]?.key).not.toBe(links[1]?.key)
    const tempOf = (i: (typeof links)[number]) => {
      const op = i.ops[0]
      return op?.op === 'create-link' ? op.tempId : undefined
    }
    expect(links[0]?.marks).toEqual([{ target: tempOf(links[0]!), patch: { naoMexer: true } }])
    expect(links[1]?.marks).toEqual([])
  })

  it('duplicados em pastas diferentes no navegador: a marca vai só para o link da sua pasta', () => {
    const tree = browser([
      folder('5', '1', 'A', [link('10', '5', 'X', 'https://x.example/')]),
      folder('6', '1', 'B', [link('11', '6', 'X', 'https://x.example/')]),
    ])
    const rows = csvRows(tree, marksOf({ id: '11', naoMexer: true }))
    const preview = planImport(tree, new Map(), rows)
    expect(preview.items.map((i) => [i.kind, i.marks])).toEqual([['marcar', [{ target: '11', patch: { naoMexer: true } }]]])
  })

  it('mesma URL duas vezes na mesma pasta: desempata pela ordem, sem fundir', () => {
    const tree = browser([link('10', '1', 'Primeiro', 'https://x.example/')])
    const rows = [
      row({ title: 'Primeiro', url: 'https://x.example/', ordem: 0 }),
      row({ title: 'Segundo', url: 'https://x.example/', ordem: 1, sugestao: 'Y' }),
    ]
    const preview = planImport(tree, new Map(), rows)
    expect(kinds(preview)).toEqual(['criar-link Segundo'])
    const op = preview.items[0]?.ops[0]
    expect(op).toMatchObject({ op: 'create-link', parentId: '1', title: 'Segundo', url: 'https://x.example/' })
    expect(preview.items[0]?.marks).toEqual([{ target: op?.op === 'create-link' ? op.tempId : '', patch: { sugestao: 'Y' } }])

    // As duas linhas já existem: a marca da segunda vai para o segundo link, não para o primeiro.
    const both = browser([link('10', '1', 'Primeiro', 'https://x.example/'), link('11', '1', 'Segundo', 'https://x.example/')])
    const p2 = planImport(both, new Map(), rows)
    expect(p2.items.map((i) => [i.kind, i.marks])).toEqual([['marcar', [{ target: '11', patch: { sugestao: 'Y' } }]]])
  })

  it('protegido por marca própria: o move vai para blocked com o motivo', () => {
    const tree = browser([folder('5', '1', 'Dev')], [link('20', '2', 'Ex', 'https://ex.example/')])
    const rows = [row({ path: ['Barra de favoritos', 'Dev'], title: 'Ex', url: 'https://ex.example/' })]
    const preview = planImport(tree, marksOf({ id: '20', naoMexer: true }), rows)
    expect(preview.items).toEqual([])
    expect(preview.blocked).toHaveLength(1)
    expect(preview.blocked[0]?.label).toBe('Ex')
    expect(preview.blocked[0]?.reason).toMatch(/não mexer/)
  })

  it('protegido por pasta marcada: blocked cita a pasta, e a marca do CSV ainda é aplicada', () => {
    const tree = browser([folder('5', '1', 'Dev')], [folder('6', '2', 'Trancada', [link('20', '6', 'Ex', 'https://ex.example/')])])
    const rows = [row({ path: ['Barra de favoritos', 'Dev'], title: 'Ex', url: 'https://ex.example/', naoMexer: true, aprovado: 'sim' })]
    const preview = planImport(tree, marksOf({ id: '6', naoMexer: true }), rows)
    expect(preview.blocked).toHaveLength(1)
    expect(preview.blocked[0]?.reason).toMatch(/Trancada/)
    expect(preview.items.map((i) => [i.kind, i.ops, i.marks])).toEqual([
      ['marcar', [], [{ target: '20', patch: { naoMexer: true, aprovado: 'sim' } }]],
    ])
  })

  it('marcas: nao_mexer=sim num link sem marca vira marcar; célula vazia não apaga; sugestao/aprovado sobrescrevem', () => {
    const tree = browser([link('10', '1', 'A', 'https://a.example/'), link('11', '1', 'B', 'https://b.example/')])
    const marks = marksOf({ id: '11', naoMexer: true, sugestao: 'Velha', aprovado: 'nao' })
    const rows = [
      row({ title: 'A', url: 'https://a.example/', naoMexer: true }),
      row({ title: 'B', url: 'https://b.example/', ordem: 1 }),
    ]
    const p1 = planImport(tree, marks, rows)
    expect(p1.items.map((i) => [i.kind, i.marks])).toEqual([['marcar', [{ target: '10', patch: { naoMexer: true } }]]])

    const p2 = planImport(tree, marks, [row({ title: 'B', url: 'https://b.example/', ordem: 1, sugestao: 'Nova', aprovado: 'sim' })])
    expect(p2.items.map((i) => [i.kind, i.marks])).toEqual([['marcar', [{ target: '11', patch: { sugestao: 'Nova', aprovado: 'sim' } }]]])
  })

  it('marca em pasta existente vira marcar; em pasta nova vai junto do criar-pasta', () => {
    const tree = browser([folder('5', '1', 'Dev')])
    const rows = [
      row({ tipo: 'pasta', path: ['Barra de favoritos', 'Dev'], title: 'Dev', url: '', naoMexer: true }),
      row({ tipo: 'pasta', path: ['Barra de favoritos', 'Nova'], title: 'Nova', url: '', sugestao: 'S' }),
    ]
    const preview = planImport(tree, new Map(), rows)
    expect(preview.items.map((i) => [i.kind, i.marks])).toEqual([
      ['marcar', [{ target: '5', patch: { naoMexer: true } }]],
      ['criar-pasta', [{ target: expect.any(String), patch: { sugestao: 'S' } }]],
    ])
    const plan = assembleImportPlan(preview, allKeys(preview), tree, 1)
    const created = plan.operations.find((o) => o.op === 'create-folder')
    expect(plan.marks?.[1]?.target).toBe(created?.op === 'create-folder' ? created.tempId : '')
  })

  it('raízes: mobile ausente → ignored; título da raiz em outro idioma casa pelo token', () => {
    const tree = browser([folder('5', '1', 'Dev')], [], null)
    const rows = [
      row({ raiz: 'mobile', path: ['Mobile bookmarks'], title: 'M', url: 'https://m.example/' }),
      row({ raiz: 'mobile', tipo: 'pasta', path: ['Mobile bookmarks', 'P'], title: 'P', url: '' }),
      row({ raiz: 'barra', tipo: 'pasta', path: ['Bookmarks bar', 'Dev'], title: 'Dev', url: '' }),
      row({ raiz: 'barra', path: ['Bookmarks bar', 'Dev'], title: 'N', url: 'https://n.example/' }),
    ]
    const preview = planImport(tree, new Map(), rows)
    expect(preview.ignored.map((i) => i.label)).toEqual(['M', 'P'])
    expect(preview.ignored[0]?.reason).toMatch(/mobile/i)
    expect(kinds(preview)).toEqual(['criar-link N'])
    expect(preview.items[0]?.ops[0]).toMatchObject({ op: 'create-link', parentId: '5' })
  })

  it('URL não http(s) que escapou da leitura vai para ignored', () => {
    const preview = planImport(browser(), new Map(), [row({ title: 'JS', url: 'javascript:alert(1)' })])
    expect(preview.items).toEqual([])
    expect(preview.ignored.map((i) => i.label)).toEqual(['JS'])
  })

  it('pastas: vazia do CSV vira criar-pasta; existente não gera nada; nunca remove, renomeia nem mexe nas raízes', () => {
    const tree = browser([folder('5', '1', 'Dev', [link('10', '5', 'Velho', 'https://v.example/')])], [link('20', '2', 'Solto', 'https://s.example/')])
    const rows = [
      row({ tipo: 'pasta', path: ['Barra de favoritos'], title: 'Barra de favoritos', url: '' }),
      row({ tipo: 'pasta', path: ['Outra raiz'], raiz: 'outros', title: 'Renomeada', url: '' }),
      row({ tipo: 'pasta', path: ['Barra de favoritos', 'Dev'], title: 'Dev', url: '' }),
      row({ tipo: 'pasta', path: ['Barra de favoritos', 'Vazia'], title: 'Vazia', url: '' }),
      row({ path: ['Barra de favoritos', 'Dev'], title: 'Outro título', url: 'https://v.example/' }),
    ]
    const preview = planImport(tree, new Map(), rows)
    expect(kinds(preview)).toEqual(['criar-pasta Vazia'])
    expect(preview.items[0]?.needsFolders).toEqual(['barra|Vazia'])
    const plan = assembleImportPlan(preview, allKeys(preview), tree, 1)
    expect(plan.operations).toEqual([{ op: 'create-folder', tempId: expect.any(String), parentId: '1', title: 'Vazia' }])
    for (const op of allOps(preview)) expect(op.op).not.toBe('remove')
    expect(plan.operations.some((o) => o.op === 'move' && ['1', '2', '3'].includes(o.id))).toBe(false)
  })

  it('pasta em vários níveis sem linhas dos ancestrais: needsFolders traz os ancestrais, pai antes do filho', () => {
    const preview = planImport(browser(), new Map(), [row({ path: ['Barra de favoritos', 'A', 'B/C'], title: 'L', url: 'https://l.example/' })])
    expect(preview.items[0]?.needsFolders).toEqual(['barra|A', 'barra|A/B\\/C'])
    const plan = assembleImportPlan(preview, allKeys(preview), browser(), 1)
    const [a, b, l] = plan.operations
    expect(a).toMatchObject({ op: 'create-folder', parentId: '1', title: 'A' })
    expect(b).toMatchObject({ op: 'create-folder', parentId: a?.op === 'create-folder' ? a.tempId : '', title: 'B/C' })
    expect(l).toMatchObject({ op: 'create-link', parentId: b?.op === 'create-folder' ? b.tempId : '', title: 'L' })
  })
})

describe('assembleImportPlan', () => {
  const rows = [
    row({ path: ['Barra de favoritos', 'Nova'], title: 'L1', url: 'https://l1.example/', naoMexer: true }),
    row({ path: ['Barra de favoritos', 'Nova'], title: 'L2', url: 'https://l2.example/', ordem: 1 }),
    row({ path: ['Barra de favoritos', 'Só'], title: 'L3', url: 'https://l3.example/' }),
  ]

  it('sem itens escolhidos devolve plano vazio', () => {
    const preview = planImport(browser(), new Map(), rows)
    const plan = assembleImportPlan(preview, new Set(), browser(), 1)
    expect(plan.operations).toEqual([])
    expect(plan.marks ?? []).toEqual([])
    expect(plan.label).toBe('Importar estrutura (0 itens)')
  })

  it('desmarcar o único item de uma pasta nova não cria a pasta; dois itens na mesma pasta a criam uma vez', () => {
    const preview = planImport(browser(), new Map(), rows)
    const keys = new Set(preview.items.filter((i) => i.label !== 'L3').map((i) => i.key))
    const plan = assembleImportPlan(preview, keys, browser(), 1)
    expect(plan.label).toBe('Importar estrutura (2 itens)')
    expect(assembleImportPlan(preview, new Set([preview.items[0]!.key]), browser(), 1).label).toBe('Importar estrutura (1 item)')
    const folders = plan.operations.filter((o) => o.op === 'create-folder')
    expect(folders.map((f) => f.op === 'create-folder' && f.title)).toEqual(['Nova'])
  })

  it('toda create-* tem tempId único e as marcas apontam para eles', async () => {
    const preview = planImport(browser(), new Map(), rows)
    const plan = assembleImportPlan(preview, allKeys(preview), browser(), 1)
    const temps = plan.operations.flatMap((o) => (o.op === 'create-folder' || o.op === 'create-link' ? [o.tempId] : []))
    expect(temps).toHaveLength(5)
    expect(temps.every((t) => typeof t === 'string')).toBe(true)
    expect(new Set(temps).size).toBe(5)
    expect(plan.marks).toHaveLength(1)
    expect(temps).toContain(plan.marks?.[0]?.target)

    const marks = makeFakeMarks()
    const api = makeFakeApi(browser())
    const r = await runPlan(plan, api, 1, memStore(marks))
    const l1 = (await api.getTree()).flatMap(function walk(n: BmNode): BmNode[] { return n.kind === 'folder' ? n.children.flatMap(walk) : [n] }).find((n) => n.title === 'L1')
    expect(r.failed).toEqual([])
    expect(marks.data.get(l1?.id ?? '')).toEqual({ id: l1?.id, naoMexer: true })
  })

  it('cria itens novos na sequência do CSV, mesmo misturando pastas e links na mesma pasta', async () => {
    const source = browser([link('10', '1', 'Antes', 'https://antes.example/'), folder('5', '1', 'Meio', [link('11', '5', 'Dentro', 'https://dentro.example/')]), link('12', '1', 'Depois', 'https://depois.example/')])
    const preview = planImport(browser(), new Map(), csvRows(source))
    const plan = assembleImportPlan(preview, allKeys(preview), browser(), 1)
    const api = makeFakeApi(browser())
    await runPlan(plan, api, 1, memStore())
    const top = (await api.getTree())[0] as BmFolder
    expect(shape(top.children)).toEqual(shape((source[0] as BmFolder).children))
  })
})
