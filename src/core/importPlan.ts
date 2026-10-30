import { isProtectedEffective, type ItemMark, type MarksMap, rootToken } from './marks'
import { decodePath, encodePath, type StructureRow } from './structureCsv'
import { findNode, flattenLinks } from './tree'
import type { BmFolder, BmNode, FlatLink, Operation, Plan, PlanMark } from './types'
import { normalizeUrl } from './url'

export type ImportKind = 'criar-link' | 'criar-pasta' | 'mover' | 'marcar'

export interface ImportItem {
  key: string
  kind: ImportKind
  label: string
  detail?: string
  /** Chaves (`raiz|caminho`) das pastas que precisam ser criadas para o item valer, pais antes dos filhos. */
  needsFolders: string[]
  ops: Operation[]
  marks: PlanMark[]
}

export interface ImportPreview {
  items: ImportItem[]
  blocked: { label: string; reason: string }[]
  ignored: { label: string; reason: string }[]
}

type Raiz = StructureRow['raiz']
type MarkPatch = PlanMark['patch']

const ROOT_NAMES: Record<Raiz, string> = {
  barra: 'Barra de favoritos',
  outros: 'Outros favoritos',
  mobile: 'Favoritos para dispositivos móveis',
}

/**
 * Chave de pasta: `raiz|caminho` (caminho sem o nome da raiz, com `encodePath`). A própria raiz é só
 * `raiz`, sem `|`, para não se confundir com uma pasta de título vazio logo abaixo dela.
 */
const folderKey = (raiz: string, sub: string[]): string => (sub.length === 0 ? raiz : `${raiz}|${encodePath(sub)}`)
/** Chave de link: URL normalizada + pasta + posição entre os iguais da mesma pasta (ordem de aparição). */
const linkKey = (norm: string, fk: string, n: number): string => JSON.stringify([norm, fk, n])
const folderTempId = (key: string): string => `importar-pasta:${key}`

interface TreeIndex {
  roots: Map<Raiz, BmFolder>
  /** Chave de pasta → ids das pastas com essa chave, em pré-ordem (títulos repetidos dão mais de um). */
  folders: Map<string, string[]>
  /** Chave de link → id do link existente. */
  links: Map<string, string>
}

function indexTree(tree: BmNode[]): TreeIndex {
  const roots = new Map<Raiz, BmFolder>()
  const folders = new Map<string, string[]>()
  const links = new Map<string, string>()
  const seen = new Map<string, number>()

  const walk = (f: BmFolder, raiz: Raiz, sub: string[]) => {
    const fk = folderKey(raiz, sub)
    folders.set(fk, [...(folders.get(fk) ?? []), f.id])
    for (const c of f.children) {
      if (c.kind === 'folder') {
        walk(c, raiz, [...sub, c.title])
        continue
      }
      const norm = normalizeUrl(c.url)
      if (norm === null) continue
      const group = JSON.stringify([norm, fk])
      const n = seen.get(group) ?? 0
      seen.set(group, n + 1)
      links.set(linkKey(norm, fk, n), c.id)
    }
  }

  const top = tree[0]
  for (const child of top && top.kind === 'folder' ? top.children : []) {
    const raiz = rootToken(tree, child.id)
    if (raiz && child.kind === 'folder' && !roots.has(raiz)) {
      roots.set(raiz, child)
      walk(child, raiz, [])
    }
  }
  return { roots, folders, links }
}

/** Campos do CSV não vazios que mudam a marca atual (célula vazia nunca apaga). */
function markPatch(r: StructureRow, prev: ItemMark | undefined): MarkPatch {
  const p: MarkPatch = {}
  if (r.naoMexer && !prev?.naoMexer) p.naoMexer = true
  if (r.sugestao && r.sugestao !== prev?.sugestao) p.sugestao = r.sugestao
  if (r.aprovado && r.aprovado !== prev?.aprovado) p.aprovado = r.aprovado
  return p
}

const hasFields = (p: MarkPatch): boolean => Object.keys(p).length > 0

function describeMarks(p: MarkPatch): string {
  const parts: string[] = []
  if (p.naoMexer) parts.push('não mexer')
  if (p.sugestao) parts.push(`sugestão "${p.sugestao}"`)
  if (p.aprovado) parts.push(`aprovado: ${p.aprovado}`)
  return `Marcas: ${parts.join(', ')}`
}

const withMarks = (detail: string, p: MarkPatch): string => (hasFields(p) ? `${detail}. ${describeMarks(p)}` : detail)

function countBy<T>(list: T[], keyOf: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of list) {
    const k = keyOf(x)
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

/**
 * Casa as linhas do CSV com a árvore e lista o que importar. Só cria e move: nunca remove nem
 * renomeia, e as raízes do Chrome nunca são criadas nem movidas. Pastas novas não viram operação
 * aqui: entram em `needsFolders`, e `assembleImportPlan` as cria.
 */
export function planImport(tree: BmNode[], marks: MarksMap, rows: StructureRow[]): ImportPreview {
  const idx = indexTree(tree)
  const browserLinks = flattenLinks(tree)
  const browserCount = countBy(browserLinks, (l) => normalizeUrl(l.url))
  const csvCount = countBy(rows, (r) => (r.tipo === 'link' ? normalizeUrl(r.url) : null))
  const byUrl = new Map<string, FlatLink>()
  for (const l of browserLinks) {
    const norm = normalizeUrl(l.url)
    if (norm !== null) byUrl.set(norm, l)
  }

  const preview: ImportPreview = { items: [], blocked: [], ignored: [] }
  const { items, blocked, ignored } = preview
  const newFolders = new Map<string, ImportItem>()
  const folderRows = new Map<string, number>()
  const linkRows = new Map<string, number>()
  let linkTemps = 0

  for (const r of rows) {
    const label = r.title || r.url || (r.path.at(-1) ?? '')
    const root = idx.roots.get(r.raiz)
    if (!root) {
      ignored.push({ label, reason: `A raiz "${r.raiz}" (${ROOT_NAMES[r.raiz]}) não existe neste navegador.` })
      continue
    }
    const sub = r.path.slice(1)
    const where = (s: string[]) => [root.title, ...s].join(' / ')
    /** Pasta de destino (id real ou tempId) e as pastas que faltam até ela. */
    const ensure = (s: string[]): { parentId: string; needs: string[] } => {
      let parentId = root.id
      const needs: string[] = []
      for (let i = 1; i <= s.length; i++) {
        const key = folderKey(r.raiz, s.slice(0, i))
        const existing = idx.folders.get(key)?.[0]
        if (existing !== undefined) parentId = existing
        else {
          needs.push(key)
          parentId = folderTempId(key)
        }
      }
      return { parentId, needs }
    }
    const marcar = (key: string, target: string, patch: MarkPatch) =>
      items.push({ key, kind: 'marcar', label, detail: describeMarks(patch), needsFolders: [], ops: [], marks: [{ target, patch }] })

    if (r.tipo === 'pasta') {
      const key = folderKey(r.raiz, sub)
      const n = folderRows.get(key) ?? 0
      folderRows.set(key, n + 1)
      const ids = idx.folders.get(key)
      const existingId = ids?.[n] ?? ids?.[0]
      if (existingId !== undefined) {
        const patch = markPatch(r, marks.get(existingId))
        if (hasFields(patch)) marcar(n === 0 ? key : JSON.stringify([key, n]), existingId, patch)
        continue
      }
      const patch = markPatch(r, undefined)
      const mark = hasFields(patch) ? [{ target: folderTempId(key), patch }] : []
      const already = newFolders.get(key)
      if (already) {
        already.marks.push(...mark)
        continue
      }
      const item: ImportItem = {
        key,
        kind: 'criar-pasta',
        label,
        detail: withMarks(`Nova pasta em ${where(sub.slice(0, -1))}`, patch),
        needsFolders: ensure(sub).needs,
        ops: [],
        marks: mark,
      }
      newFolders.set(key, item)
      items.push(item)
      continue
    }

    const norm = normalizeUrl(r.url)
    if (norm === null) {
      ignored.push({ label, reason: `URL não suportada: ${r.url}` })
      continue
    }
    const fk = folderKey(r.raiz, sub)
    const group = JSON.stringify([norm, fk])
    const n = linkRows.get(group) ?? 0
    linkRows.set(group, n + 1)
    const key = linkKey(norm, fk, n)

    const existingId = idx.links.get(key)
    if (existingId !== undefined) {
      const patch = markPatch(r, marks.get(existingId))
      if (hasFields(patch)) marcar(key, existingId, patch)
      continue
    }

    const src = browserCount.get(norm) === 1 && csvCount.get(norm) === 1 ? byUrl.get(norm) : undefined
    if (src) {
      const patch = markPatch(r, marks.get(src.id))
      const prot = isProtectedEffective(tree, marks, src.id)
      if (prot.protected) {
        const by = prot.byFolderId !== undefined ? findNode(tree, prot.byFolderId)?.title : undefined
        const why = by !== undefined ? `Está na pasta "${by}", marcada como "não mexer"` : 'Marcado como "não mexer"'
        blocked.push({ label, reason: `${why}; não será movido para ${where(sub)}.` })
        if (hasFields(patch)) marcar(key, src.id, patch)
        continue
      }
      const { parentId, needs } = ensure(sub)
      items.push({
        key,
        kind: 'mover',
        label,
        detail: withMarks(`De ${src.path.join(' / ')} para ${where(sub)}`, patch),
        needsFolders: needs,
        ops: [{ op: 'move', id: src.id, toParentId: parentId }],
        marks: hasFields(patch) ? [{ target: src.id, patch }] : [],
      })
      continue
    }

    const tempId = `importar-link:${linkTemps++}`
    const patch = markPatch(r, undefined)
    const { parentId, needs } = ensure(sub)
    items.push({
      key,
      kind: 'criar-link',
      label,
      detail: withMarks(`Novo favorito em ${where(sub)}`, patch),
      needsFolders: needs,
      ops: [{ op: 'create-link', tempId, parentId, title: r.title, url: r.url }],
      marks: hasFields(patch) ? [{ target: tempId, patch }] : [],
    })
  }
  return preview
}

/** Inverso de `folderKey` para pastas abaixo de uma raiz (chaves de `needsFolders`). */
function splitFolderKey(key: string): { raiz: string; sub: string[] } {
  const sep = key.indexOf('|')
  const rest = key.slice(sep + 1)
  return { raiz: key.slice(0, sep), sub: rest === '' ? [''] : decodePath(rest) }
}

/**
 * Plano com os itens escolhidos, na ordem da prévia. Cada pasta necessária é criada uma única vez,
 * logo antes do primeiro item que precisa dela (pais antes dos filhos); assim pastas e links novos
 * saem na sequência do CSV. Uma pasta que só um item desmarcado pedia não é criada.
 */
export function assembleImportPlan(preview: ImportPreview, selectedKeys: Set<string>, tree: BmNode[], now: number): Plan {
  const existing = indexTree(tree).folders
  const chosen = preview.items.filter((i) => selectedKeys.has(i.key))
  const created = new Set<string>()
  const operations: Operation[] = []
  const marks: PlanMark[] = []

  for (const item of chosen) {
    for (const key of item.needsFolders) {
      if (created.has(key)) continue
      created.add(key)
      const { raiz, sub } = splitFolderKey(key)
      const parentKey = folderKey(raiz, sub.slice(0, -1))
      const parentId = created.has(parentKey) ? folderTempId(parentKey) : (existing.get(parentKey)?.[0] ?? folderTempId(parentKey))
      operations.push({ op: 'create-folder', tempId: folderTempId(key), parentId, title: sub.at(-1) ?? '' })
    }
    operations.push(...item.ops)
    marks.push(...item.marks)
  }

  const plan: Plan = { id: `importar-${now}`, label: `Importar estrutura (${chosen.length} itens)`, operations }
  if (marks.length > 0) plan.marks = marks
  return plan
}
