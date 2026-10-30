import { assembleImportPlan, type ImportKind, type ImportPreview, planImport } from '../core/importPlan'
import type { MarksMap } from '../core/marks'
import { runPlan, type RunStore } from '../core/plan'
import { exportStructure, parseStructure, type RowIssue, type StructureRow } from '../core/structureCsv'
import type { BmNode, BookmarksApi } from '../core/types'
import { marksStore } from '../storage/flags'
import { saveEntry } from '../storage/journal'
import { latestAutoSnapshot, saveSnapshot } from '../storage/snapshots'
import { downloadText } from './download'
import { structureFileName } from './fileName'

/** Maior CSV aceito na importação (um CSV de dezenas de milhares de favoritos fica bem abaixo disso). */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024

/** Motivo para recusar o arquivo antes de lê-lo, ou null. */
export function importFileProblem(file: { size: number }): string | null {
  return file.size > MAX_IMPORT_BYTES ? 'O arquivo tem mais de 20 MB; não parece um CSV da estrutura de favoritos.' : null
}

/** Baixa o CSV da estrutura atual (pastas, favoritos e marcas). Não muda nada no navegador. */
export function exportStructureFile(tree: BmNode[], marks: MarksMap, now: number): void {
  downloadText(structureFileName(now), exportStructure(tree, marks), 'text/csv')
}

export interface ImportPreparation {
  /** Linhas válidas do CSV: `applyImport` volta a casá-las com a árvore de agora. */
  rows: StructureRow[]
  preview: ImportPreview
  issues: RowIssue[]
  /** O arquivo não pode ser importado (ex.: falta coluna); nesse caso a prévia vem vazia. */
  fatal?: string
}

const EMPTY: ImportPreview = { items: [], blocked: [], ignored: [] }

/** Lê o CSV e casa com a árvore atual. Só lê: nada muda no navegador. */
export async function previewImport(api: BookmarksApi, marks: MarksMap, text: string): Promise<ImportPreparation> {
  const { rows, issues, fatal } = parseStructure(text)
  if (fatal !== undefined) return { rows: [], preview: EMPTY, issues, fatal }
  return { rows, preview: planImport(await api.getTree(), marks, rows), issues }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "12 pastas e 140 favoritos a criar, 8 a mover, 3 marcas, 2 bloqueados, 1 ignorado", só com os itens escolhidos. */
export function importSummary(preview: ImportPreview, selected?: Set<string>): string {
  const chosen = selected ? preview.items.filter((i) => selected.has(i.key)) : preview.items
  const folders = new Set(chosen.flatMap((i) => i.needsFolders)).size
  const links = chosen.filter((i) => i.kind === 'criar-link').length
  const moves = chosen.filter((i) => i.kind === 'mover').length
  const marks = chosen.reduce((n, i) => n + i.marks.length, 0)
  const create = [
    ...(folders > 0 ? [plural(folders, 'pasta', 'pastas')] : []),
    ...(links > 0 ? [plural(links, 'favorito', 'favoritos')] : []),
  ]
  return [
    create.length > 0 ? `${create.join(' e ')} a criar` : 'Nada a criar',
    `${moves} a mover`,
    plural(marks, 'marca', 'marcas'),
    plural(preview.blocked.length, 'bloqueado', 'bloqueados'),
    plural(preview.ignored.length, 'ignorado', 'ignorados'),
  ].join(', ')
}

export interface ImportResult {
  /** Algum plano foi aplicado (com backup antes). */
  ran: boolean
  /** Operações aplicadas (pastas e favoritos criados, favoritos movidos). */
  applied: number
  /** Itens cujas marcas foram gravadas. */
  marks: number
  failed: number
  firstError?: string
  /** Itens escolhidos que mudaram no navegador desde a prévia e ficaram de fora. */
  skipped: number
  /** Plano para o Desfazer do aviso; ausente quando nada pode ser desfeito. */
  planId?: string
  /** As mudanças foram aplicadas, mas as marcas não foram gravadas (ou só em parte). */
  marksError?: string
}

const defaultStore = (): RunStore => ({ saveSnapshot, saveEntry, latestAutoSnapshot, marks: marksStore })

/**
 * Aplica os itens escolhidos da prévia. Antes, casa o CSV de novo com a árvore e as marcas de agora:
 * se algo mudou desde a prévia, um item escolhido que sumiu ou mudou de natureza (ex.: "criar" que
 * virou "marcar" porque a pasta já existe) fica de fora e é contado em `skipped`, em vez de criar
 * uma pasta duas vezes. Sempre faz um backup novo (não reaproveita o de outro plano), porque pode
 * criar centenas de itens. Sem nada escolhido, não roda nada.
 */
export async function applyImport(
  api: BookmarksApi,
  prep: Pick<ImportPreparation, 'rows' | 'preview'>,
  selected: Set<string>,
  now: number,
  store: RunStore = defaultStore(),
): Promise<ImportResult> {
  const wanted = new Map<string, ImportKind>()
  for (const i of prep.preview.items) if (selected.has(i.key)) wanted.set(i.key, i.kind)
  if (wanted.size === 0) return { ran: false, applied: 0, marks: 0, failed: 0, skipped: 0 }

  const tree = await api.getTree()
  const marks: MarksMap = new Map((store.marks ? await store.marks.all() : []).map((m) => [m.id, m]))
  const fresh = planImport(tree, marks, prep.rows)
  const keep = new Set(fresh.items.filter((i) => wanted.get(i.key) === i.kind).map((i) => i.key))
  const skipped = wanted.size - keep.size
  if (keep.size === 0) return { ran: false, applied: 0, marks: 0, failed: 0, skipped }

  const plan = assembleImportPlan(fresh, keep, tree, now)
  const r = await runPlan(plan, api, now, store, { shareBackup: false })

  const tempIds = new Set(plan.operations.flatMap((op) => (op.op === 'create-folder' || op.op === 'create-link') && op.tempId !== undefined ? [op.tempId] : []))
  const marked = new Set((plan.marks ?? []).flatMap((m) => (tempIds.has(m.target) ? (r.idMap[m.target] !== undefined ? [r.idMap[m.target]] : []) : [m.target])))

  const result: ImportResult = { ran: true, applied: r.applied, marks: r.marksError === undefined ? marked.size : 0, failed: r.failed.length, skipped }
  if (r.failed[0]) result.firstError = r.failed[0].error
  // `runPlan` só grava a entrada do diário quando há algo a desfazer.
  if (r.entry.inverse.length > 0 || r.entry.marksBefore) result.planId = r.entry.planId
  if (r.marksError !== undefined) result.marksError = r.marksError
  return result
}

/** Texto do aviso depois de `applyImport`. */
export function describeImport(r: ImportResult): string {
  if (!r.ran) {
    return r.skipped > 0
      ? `Nada aplicado: ${r.skipped === 1 ? 'o item escolhido mudou' : `os ${r.skipped} itens escolhidos mudaram`} no navegador desde a prévia`
      : 'Nada selecionado para importar'
  }
  const done = r.applied > 0 || r.marks === 0 ? [plural(r.applied, 'item criado ou movido', 'itens criados ou movidos')] : []
  if (r.marks > 0) done.push(plural(r.marks, 'marca gravada', 'marcas gravadas'))
  const parts = [`Importação aplicada: ${done.join(', ')}`]
  if (r.failed > 0) parts.push(`${r.failed} ${r.failed === 1 ? 'falhou' : 'falharam'}${r.firstError ? ` (${r.firstError})` : ''}`)
  if (r.skipped > 0) parts.push(`${plural(r.skipped, 'item mudou', 'itens mudaram')} desde a prévia e ${r.skipped === 1 ? 'ficou' : 'ficaram'} de fora`)
  if (r.marksError !== undefined) parts.push(`As marcas não foram gravadas (${r.marksError}); Desfazer ainda reverte o resto`)
  return parts.join('. ')
}
