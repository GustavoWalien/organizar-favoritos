import { describe, expect, it } from 'vitest'
import type { ItemMark, MarksMap } from '../../src/core/marks'
import { type RunStore, type UndoStore, undoIfLatest } from '../../src/core/plan'
import { createSnapshot } from '../../src/core/snapshot'
import { exportStructure } from '../../src/core/structureCsv'
import type { BmFolder, BmNode, JournalEntry, Snapshot } from '../../src/core/types'
import type { MarksStore } from '../../src/storage/flags'
import {
  applyImport,
  describeImport,
  importFileProblem,
  type ImportResult,
  importSummary,
  MAX_IMPORT_BYTES,
  previewImport,
} from '../../src/ui/marksActions'
import { makeFakeApi, makeFakeMarks } from '../fixtures/fakeApi'

const link = (id: string, parentId: string, title: string, url: string): BmNode => ({ kind: 'link', id, parentId, title, url, dateAdded: 0 })
const folder = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const browser = (barra: BmNode[] = [], outros: BmNode[] = []): BmNode[] => [
  {
    kind: 'folder', id: '0', title: '', children: [
      folder('1', '0', 'Barra de favoritos', barra),
      folder('2', '0', 'Outros favoritos', outros),
      folder('3', '0', 'Favoritos para dispositivos móveis'),
    ],
  },
]
const marksOf = (...ms: ItemMark[]): MarksMap => new Map(ms.map((m) => [m.id, m]))

/** Estrutura sem ids: pastas como [título, filhos], links como "título url". */
type Shape = string | [string, Shape[]]
const shape = (nodes: BmNode[]): Shape[] => nodes.map((n) => (n.kind === 'link' ? `${n.title} ${n.url}` : [n.title, shape(n.children)]))

/** Barra: Dev (não mexer) com A e B, Leitura com C; Outros: D. */
const source = browser(
  [
    folder('5', '1', 'Dev', [link('10', '5', 'A', 'https://a.example/'), link('11', '5', 'B', 'https://b.example/')]),
    folder('6', '1', 'Leitura', [link('12', '6', 'C', 'https://c.example/')]),
  ],
  [link('20', '2', 'D', 'https://d.example/')],
)
const sourceCsv = exportStructure(source, marksOf({ id: '5', naoMexer: true }))

/** Store em memória com diário e backups, para aplicar e desfazer. */
function memStores(marks: MarksStore = makeFakeMarks()) {
  const entries: JournalEntry[] = []
  const snapshots: Snapshot[] = []
  const run: RunStore = {
    saveSnapshot: async (s) => { snapshots.push(s) },
    saveEntry: async (e) => { entries.push(e) },
    latestAutoSnapshot: async () => snapshots.at(-1),
    marks,
  }
  const undo: UndoStore = {
    lastEntry: async () => entries.at(-1),
    deleteEntry: async (id) => { entries.splice(entries.findIndex((e) => e.planId === id), 1) },
    marks,
  }
  return { entries, snapshots, run, undo }
}

const findFolders = (nodes: BmNode[], title: string): BmFolder[] =>
  nodes.flatMap((n) => (n.kind === 'folder' ? [...(n.title === title ? [n] : []), ...findFolders(n.children, title)] : []))
const keysOf = (labels: string[], prep: { preview: { items: { key: string; label: string }[] } }) =>
  new Set(prep.preview.items.filter((i) => labels.includes(i.label)).map((i) => i.key))
const allKeys = (prep: { preview: { items: { key: string }[] } }) => new Set(prep.preview.items.map((i) => i.key))

describe('previewImport', () => {
  it('arquivo inválido devolve fatal, prévia vazia e não toca em nada', async () => {
    const api = makeFakeApi(browser())
    const prep = await previewImport(api, new Map(), 'nome,endereco\nx,y\n')
    expect(prep.fatal).toMatch(/Faltam colunas obrigatórias/)
    expect(prep.preview).toEqual({ items: [], blocked: [], ignored: [] })
    expect(prep.rows).toEqual([])
    expect(api.calls).toEqual([])
  })

  it('casa o CSV com a árvore atual e repassa os problemas das linhas', async () => {
    const api = makeFakeApi(browser())
    const csv = `${sourceCsv}\r\nlink,Barra de favoritos,X,ftp://x.example/,9,,,,barra`
    const prep = await previewImport(api, new Map(), csv)
    expect(prep.fatal).toBeUndefined()
    expect(prep.issues).toEqual([{ line: 11, message: 'URL não suportada: ftp://x.example/' }])
    expect(prep.preview.items.map((i) => `${i.kind} ${i.label}`)).toEqual([
      'criar-pasta Dev', 'criar-link A', 'criar-link B', 'criar-pasta Leitura', 'criar-link C', 'criar-link D',
    ])
    expect(api.calls).toEqual([])
  })
})

describe('applyImport', () => {
  it('com todos os itens marcados cria a estrutura, grava as marcas e faz um backup novo', async () => {
    const api = makeFakeApi(browser())
    const marks = makeFakeMarks()
    const { run, snapshots, entries } = memStores(marks)
    // Um backup automático recente não é reaproveitado: a importação faz o seu.
    snapshots.push(createSnapshot(browser(), 'outro plano', 999_000, 'auto'))
    const prep = await previewImport(api, new Map(), sourceCsv)
    const r = await applyImport(api, prep, allKeys(prep), 1_000_000, run)

    const tree = await api.getTree()
    expect(shape(tree)).toEqual(shape(source))
    const dev = findFolders(tree, 'Dev')[0]!
    expect(marks.data.get(dev.id)).toEqual({ id: dev.id, naoMexer: true })
    expect(r).toMatchObject({ ran: true, applied: 6, marks: 1, failed: 0, skipped: 0 })
    expect(r.planId).toBe(entries.at(-1)?.planId)
    expect(r.marksError).toBeUndefined()
    expect(snapshots).toHaveLength(2)
    expect(entries.at(-1)?.snapshotId).toBe(snapshots[1]?.id)
  })

  it('um item desmarcado não é criado', async () => {
    const api = makeFakeApi(browser())
    const { run } = memStores()
    const prep = await previewImport(api, new Map(), sourceCsv)
    const selected = allKeys(prep)
    for (const k of keysOf(['C'], prep)) selected.delete(k)
    const r = await applyImport(api, prep, selected, 1, run)
    const leitura = findFolders(await api.getTree(), 'Leitura')[0]!
    expect(leitura.children).toEqual([])
    expect(r.applied).toBe(5)
  })

  it('sem nada selecionado não roda nada', async () => {
    const api = makeFakeApi(browser())
    const { run, snapshots, entries } = memStores()
    const prep = await previewImport(api, new Map(), sourceCsv)
    const r = await applyImport(api, prep, new Set(), 1, run)
    expect(r).toEqual({ ran: false, applied: 0, marks: 0, failed: 0, skipped: 0 })
    expect(api.calls).toEqual([])
    expect(snapshots).toEqual([])
    expect(entries).toEqual([])
  })

  it('failed conta as falhas sem interromper o resto', async () => {
    const api = makeFakeApi(browser())
    const create = api.createLink.bind(api)
    api.createLink = async (parentId, title, url) => {
      if (title === 'B') throw new Error('cota excedida')
      return create(parentId, title, url)
    }
    const { run } = memStores()
    const prep = await previewImport(api, new Map(), sourceCsv)
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    expect(r.failed).toBe(1)
    expect(r.firstError).toBe('cota excedida')
    expect(r.applied).toBe(5)
    const titles = (await api.getTree()).flatMap(function all(n: BmNode): string[] { return n.kind === 'link' ? [n.title] : n.children.flatMap(all) })
    expect(titles).toEqual(['A', 'C', 'D'])
  })

  it('o planId devolvido desfaz tudo, inclusive as marcas', async () => {
    const api = makeFakeApi(browser())
    const marks = makeFakeMarks()
    const { run, undo } = memStores(marks)
    const prep = await previewImport(api, new Map(), sourceCsv)
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    expect(await undoIfLatest(api, r.planId!, undo)).toMatchObject({ undone: 7, skipped: 0 })
    expect(shape(await api.getTree())).toEqual(shape(browser()))
    expect(marks.data.size).toBe(0)
  })

  it('a árvore mudou desde a prévia: usa a árvore de agora, não cria pasta duas vezes e conta o que mudou', async () => {
    const api = makeFakeApi(browser())
    const { run } = memStores()
    const prep = await previewImport(api, new Map(), sourceCsv)
    const devId = await api.createFolder('1', 'Dev') // criada à mão depois da prévia
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    const tree = await api.getTree()
    const devs = findFolders(tree, 'Dev')
    expect(devs.map((d) => d.id)).toEqual([devId])
    expect(shape(devs[0]!.children)).toEqual(['A https://a.example/', 'B https://b.example/'])
    // "criar a pasta Dev" virou "marcar Dev": mudou de natureza, fica de fora e é contado.
    expect(r.skipped).toBe(1)
    expect(r.marks).toBe(0)
  })

  it('usa as marcas de agora: um favorito protegido depois da prévia não é movido', async () => {
    const api = makeFakeApi(browser([], [link('20', '2', 'X', 'https://x.example/')]))
    const marks = makeFakeMarks()
    const { run } = memStores(marks)
    const csv = exportStructure(browser([folder('6', '1', 'Leitura', [link('30', '6', 'X', 'https://x.example/')])]), new Map())
    const prep = await previewImport(api, new Map(), csv)
    expect(prep.preview.items.map((i) => i.kind)).toEqual(['criar-pasta', 'mover'])
    await marks.put([{ id: '20', naoMexer: true }])
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    expect(r).toMatchObject({ ran: true, applied: 1, skipped: 1 })
    expect(api.calls).toEqual(['createFolder 1 Leitura'])
  })

  it('tudo o que foi escolhido sumiu: não roda e diz quantos', async () => {
    const api = makeFakeApi(browser())
    const { run, snapshots } = memStores()
    const csv = exportStructure(browser([], [link('20', '2', 'D', 'https://d.example/')]), new Map())
    const prep = await previewImport(api, new Map(), csv)
    await api.createLink('2', 'D', 'https://d.example/')
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    expect(r).toEqual({ ran: false, applied: 0, marks: 0, failed: 0, skipped: 1 })
    expect(snapshots).toEqual([])
  })

  it('marcas que não puderam ser gravadas voltam em marksError, e o desfazer continua valendo', async () => {
    const api = makeFakeApi(browser())
    const marks = makeFakeMarks()
    marks.put = async () => { throw new Error('disco cheio') }
    const { run, entries } = memStores(marks)
    const prep = await previewImport(api, new Map(), sourceCsv)
    const r = await applyImport(api, prep, allKeys(prep), 1, run)
    expect(r.marksError).toBe('disco cheio')
    expect(r.marks).toBe(0)
    expect(r.planId).toBe(entries.at(-1)?.planId)
    expect(describeImport(r)).toContain('disco cheio')
  })
})

describe('importSummary', () => {
  it('conta pastas, favoritos, movimentos, marcas, bloqueados e ignorados, com plural', async () => {
    const api = makeFakeApi(browser([link('9', '1', 'P', 'https://p.example/')], [link('20', '2', 'X', 'https://x.example/')]))
    const csv = [
      'tipo,caminho,titulo,url,ordem,nao_mexer,sugestao,aprovado,raiz',
      'pasta,Barra de favoritos/Nova,Nova,,0,sim,,,barra',
      'link,Barra de favoritos/Nova/Sub,L,https://l.example/,0,,,,barra',
      'link,Barra de favoritos/Nova,X,https://x.example/,1,,,,barra',
      'link,Barra de favoritos,P,https://p.example/,0,,Dev,,barra',
    ].join('\r\n')
    const prep = await previewImport(api, marksOf({ id: '20', naoMexer: true }), csv)
    expect(importSummary(prep.preview)).toBe('2 pastas e 1 favorito a criar, 0 a mover, 2 marcas, 1 bloqueado, 0 ignorados')
  })

  it('segue a seleção; sem criações diz "Nada a criar"', () => {
    const preview = {
      items: [
        { key: 'a', kind: 'criar-link' as const, label: 'a', needsFolders: ['barra|N'], ops: [], marks: [] },
        { key: 'b', kind: 'criar-link' as const, label: 'b', needsFolders: ['barra|N'], ops: [], marks: [] },
        { key: 'c', kind: 'mover' as const, label: 'c', needsFolders: [], ops: [], marks: [] },
      ],
      blocked: [],
      ignored: [{ label: 'z', reason: 'r' }, { label: 'y', reason: 'r' }],
    }
    expect(importSummary(preview)).toBe('1 pasta e 2 favoritos a criar, 1 a mover, 0 marcas, 0 bloqueados, 2 ignorados')
    expect(importSummary(preview, new Set(['c']))).toBe('Nada a criar, 1 a mover, 0 marcas, 0 bloqueados, 2 ignorados')
    expect(importSummary(preview, new Set(['a']))).toBe('1 pasta e 1 favorito a criar, 0 a mover, 0 marcas, 0 bloqueados, 2 ignorados')
  })
})

describe('describeImport', () => {
  const base: ImportResult = { ran: true, applied: 0, marks: 0, failed: 0, skipped: 0 }
  it('resume o que foi feito, com plural', () => {
    expect(describeImport({ ...base, applied: 1, marks: 1 })).toBe('Importação aplicada: 1 item criado ou movido, 1 marca gravada')
    expect(describeImport({ ...base, marks: 2 })).toBe('Importação aplicada: 2 marcas gravadas')
    expect(describeImport({ ...base, applied: 152, marks: 3 })).toBe('Importação aplicada: 152 itens criados ou movidos, 3 marcas gravadas')
    expect(describeImport({ ...base, applied: 2, failed: 2, firstError: 'x', skipped: 1 })).toBe(
      'Importação aplicada: 2 itens criados ou movidos. 2 falharam (x). 1 item mudou desde a prévia e ficou de fora',
    )
  })

  it('avisa quando as marcas não foram gravadas', () => {
    expect(describeImport({ ...base, applied: 3, marksError: 'disco cheio' })).toBe(
      'Importação aplicada: 3 itens criados ou movidos. As marcas não foram gravadas (disco cheio); Desfazer ainda reverte o resto',
    )
  })

  it('nada rodou', () => {
    expect(describeImport({ ...base, ran: false })).toBe('Nada selecionado para importar')
    expect(describeImport({ ...base, ran: false, skipped: 2 })).toBe('Nada aplicado: os 2 itens escolhidos mudaram no navegador desde a prévia')
  })
})

describe('importFileProblem', () => {
  it('recusa arquivos grandes demais', () => {
    expect(importFileProblem({ size: 1000 })).toBeNull()
    expect(importFileProblem({ size: MAX_IMPORT_BYTES })).toBeNull()
    expect(importFileProblem({ size: MAX_IMPORT_BYTES + 1 })).toMatch(/20 MB/)
  })
})
