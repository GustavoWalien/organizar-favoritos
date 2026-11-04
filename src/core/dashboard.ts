import { findTrash } from './cleanup'
import { findDuplicates, type KeepPolicy } from './duplicates'
import { sidebarFolders, uncategorizedLinks } from './folders'
import { findInactive } from './inactive'
import { statusOf, type LinkCheckRecord } from './linkCheckRecord'
import { flattenLinks } from './tree'
import type { BmNode } from './types'

export interface DashboardInput {
  now: number
  inactiveDays: number
  keepPolicy: KeepPolicy
  linkCheck: LinkCheckRecord | null
}

export interface Dashboard {
  /** Favoritos fora da Lixeira. */
  total: number
  /** Pastas fora das raízes do Chrome e fora da Lixeira. */
  folderCount: number
  inactive: number
  /** Cópias a mais (as que iriam para a Lixeira pela política). */
  duplicates: number
  /** Favoritos de agora cujo endereço deu `quebrado` no último teste. */
  broken: number
  uncategorized: number
  inFolders: number
  /** `inFolders / total`, arredondado para baixo; 0 sem favoritos. */
  organizedPct: number
  review: number
  reviewIds: Set<string>
  trash: number
  usage: { thisMonth: number; months1to3: number; months3to12: number; overYear: number; noRecord: number }
  /** `id: null` = Sem categoria. No máximo 6, só com contagem > 0. */
  topFolders: { id: string | null; title: string; count: number }[]
  linkCheck: { state: 'never' | 'partial' | 'done'; checkedAt: number | null }
}

const DAY_MS = 86_400_000

function countFolders(nodes: BmNode[], skipId: string | undefined): number {
  let n = 0
  for (const c of nodes) {
    if (c.kind !== 'folder' || c.id === skipId) continue
    n += 1 + countFolders(c.children, skipId)
  }
  return n
}

/** Pastas criadas pelo usuário: fora das raízes do Chrome (Barra, Outros, Mobile) e fora da Lixeira. */
export function userFolderCount(tree: BmNode[]): number {
  const trashId = findTrash(tree)?.id
  const top = tree[0]
  const roots = top && top.kind === 'folder' ? top.children : []
  return roots.reduce((n, r) => n + (r.kind === 'folder' ? countFolders(r.children, trashId) : 0), 0)
}

/** Todos os números do painel, da barra lateral e do popup, a partir de uma leitura da árvore. */
export function computeDashboard(tree: BmNode[], input: DashboardInput): Dashboard {
  const trash = findTrash(tree)
  const live = flattenLinks(tree, trash?.id)
  const total = live.length

  const inactiveIds = findInactive(live, input.now, input.inactiveDays).map((f) => f.link.id)
  const extraIds = findDuplicates(live, input.keepPolicy).flatMap((g) => g.extras.map((l) => l.id))
  const brokenIds = live.filter((l) => statusOf(input.linkCheck, l.url) === 'quebrado').map((l) => l.id)
  const reviewIds = new Set([...inactiveIds, ...extraIds, ...brokenIds])

  const uncategorized = uncategorizedLinks(tree).length
  const inFolders = total - uncategorized

  const usage = { thisMonth: 0, months1to3: 0, months3to12: 0, overYear: 0, noRecord: 0 }
  for (const l of live) {
    if (!l.dateLastUsed || l.dateLastUsed <= 0) { usage.noRecord++; continue }
    const days = (input.now - l.dateLastUsed) / DAY_MS
    if (days <= 30) usage.thisMonth++
    else if (days <= 90) usage.months1to3++
    else if (days <= 365) usage.months3to12++
    else usage.overYear++
  }

  const candidates: Dashboard['topFolders'] = [
    ...sidebarFolders(tree).map((f) => ({ id: f.id, title: f.title, count: f.count })),
    { id: null, title: 'Sem categoria', count: uncategorized },
  ]
  // `sort` é estável: no empate vale a ordem da árvore (Sem categoria por último).
  const topFolders = candidates.filter((f) => f.count > 0).sort((a, b) => b.count - a.count).slice(0, 6)

  const folderCount = userFolderCount(tree)

  const rec = input.linkCheck
  return {
    total,
    folderCount,
    inactive: inactiveIds.length,
    duplicates: extraIds.length,
    broken: brokenIds.length,
    uncategorized,
    inFolders,
    organizedPct: total === 0 ? 0 : Math.floor((inFolders * 100) / total),
    review: reviewIds.size,
    reviewIds,
    trash: trash ? flattenLinks([trash]).length : 0,
    usage,
    topFolders,
    linkCheck: rec ? { state: rec.complete ? 'done' : 'partial', checkedAt: rec.checkedAt } : { state: 'never', checkedAt: null },
  }
}

export type StepId = 'duplicados' | 'testar-links' | 'quebrados' | 'sem-uso' | 'sem-categoria' | 'backup'

export interface NextStep {
  id: StepId
  /** Quantos itens o passo resolve (0 para testar links e backup). */
  count: number
  done: boolean
}

const LINK_CHECK_MAX_AGE = 30 * DAY_MS
const BACKUP_MAX_AGE = 7 * DAY_MS

/** Os 6 passos, sempre nesta ordem. Quem desenha escolhe quantos mostrar. */
export function nextSteps(d: Dashboard, lastBackupAt: number | null, now: number): NextStep[] {
  const lc = d.linkCheck
  const linksFresh = lc.state === 'done' && lc.checkedAt !== null && now - lc.checkedAt <= LINK_CHECK_MAX_AGE
  return [
    { id: 'duplicados', count: d.duplicates, done: d.duplicates === 0 },
    { id: 'testar-links', count: 0, done: linksFresh },
    { id: 'quebrados', count: d.broken, done: d.broken === 0 },
    { id: 'sem-uso', count: d.inactive, done: d.inactive === 0 },
    { id: 'sem-categoria', count: d.uncategorized, done: d.uncategorized === 0 },
    { id: 'backup', count: 0, done: lastBackupAt !== null && now - lastBackupAt <= BACKUP_MAX_AGE },
  ]
}
