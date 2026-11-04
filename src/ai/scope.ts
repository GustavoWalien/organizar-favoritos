import { findTrash } from '../core/cleanup'
import { isProtectedEffective, rootToken, type MarksMap } from '../core/marks'
import type { BmFolder, BmNode } from '../core/types'

export type ScopeKind = 'sem-categoria' | 'pasta' | 'todos'

export interface AiScope {
  kind: ScopeKind
  /** Só no escopo `pasta`. */
  folderId?: string
  /** Se a IA pode propor pastas novas. */
  allowNew: boolean
}

/** Pasta onde um favorito pode ir. `k` é o número que a IA usa na resposta. */
export interface Candidate {
  k: number
  folderId: string
  /** "Barra › Developer › Tools Dev" (raiz pelo token fixo, não pelo título do Chrome). */
  label: string
  segments: string[]
  /** Barra ou Outros: só servem de pai para pasta nova. */
  isRoot: boolean
}

export interface ScopeItem {
  id: string
  title: string
  url: string
  domain: string
  fromFolderId: string
}

export interface ScopeResult {
  items: ScopeItem[]
  candidates: Candidate[]
  skipped: { protected: number; notWeb: number }
  /** Quantas candidatas ficaram de fora pelo limite. */
  candidatesCut: number
}

export const MAX_CANDIDATES = 1500
const ROOT_LABEL = { barra: 'Barra', outros: 'Outros', mobile: 'Mobile' } as const

/** Host em minúsculas sem "www."; null se não for http(s). */
export function domainKey(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

const isFolder = (n: BmNode): n is BmFolder => n.kind === 'folder'

/** O que vai para a IA e para onde pode ir, conforme o escopo (seções 5.1 e 5.1b do design). */
export function buildScope(tree: BmNode[], marks: MarksMap, scope: AiScope): ScopeResult {
  const trashId = findTrash(tree)?.id
  const top = tree[0]
  const roots = top && isFolder(top) ? top.children.filter(isFolder) : []
  const prot = (id: string) => isProtectedEffective(tree, marks, id).protected

  const items: ScopeItem[] = []
  const skipped = { protected: 0, notWeb: 0 }
  const all: Candidate[] = []

  const addLink = (n: BmNode, parentId: string) => {
    if (n.kind !== 'link') return
    if (prot(n.id)) { skipped.protected++; return }
    const domain = domainKey(n.url)
    if (domain === null) { skipped.notWeb++; return }
    items.push({ id: n.id, title: n.title, url: n.url, domain, fromFolderId: parentId })
  }

  /** Percorre uma pasta: links (se `takeLinks`) e candidatas (subpastas não protegidas). */
  const walk = (f: BmFolder, segments: string[], takeLinks: boolean, deep: boolean) => {
    for (const c of f.children) {
      if (c.kind === 'link') { if (takeLinks) addLink(c, f.id); continue }
      if (c.id === trashId) continue
      if (prot(c.id)) {
        // Pasta protegida: não é destino; seus links contam como protegidos.
        if (takeLinks && deep) countProtected(c)
        continue
      }
      const here = [...segments, c.title || '(sem nome)']
      all.push({ k: 0, folderId: c.id, label: here.join(' › '), segments: here, isRoot: false })
      walk(c, here, takeLinks && deep, deep)
    }
  }
  const countProtected = (f: BmFolder) => {
    for (const c of f.children) {
      if (c.kind === 'link') { if (domainKey(c.url) === null) skipped.notWeb++; else skipped.protected++ }
      else countProtected(c)
    }
  }

  if (scope.kind === 'pasta') {
    const find = (nodes: BmNode[], segs: string[]): { f: BmFolder; segs: string[] } | undefined => {
      for (const n of nodes) {
        if (!isFolder(n)) continue
        const here = [...segs, n.title || '(sem nome)']
        if (n.id === scope.folderId) return { f: n, segs: here }
        const sub = find(n.children, here)
        if (sub) return sub
      }
      return undefined
    }
    for (const r of roots) {
      const token = rootToken(tree, r.id)
      if (!token) continue
      const hit = r.id === scope.folderId ? { f: r, segs: [ROOT_LABEL[token]] } : find(r.children, [ROOT_LABEL[token]])
      if (!hit || prot(hit.f.id)) continue
      all.push({ k: 0, folderId: hit.f.id, label: hit.segs.join(' › '), segments: hit.segs, isRoot: r.id === hit.f.id })
      walk(hit.f, hit.segs, true, true)
      break
    }
  } else {
    for (const r of roots) {
      const token = rootToken(tree, r.id)
      if (!token) continue
      const segs = [ROOT_LABEL[token]]
      if (token !== 'mobile') all.push({ k: 0, folderId: r.id, label: segs[0]!, segments: segs, isRoot: true })
      // Links soltos da raiz: em "todos" o `walk` já os pega (menos em Mobile, que não é percorrido por ele).
      if (scope.kind === 'sem-categoria' || token === 'mobile') for (const c of r.children) if (c.kind === 'link') addLink(c, r.id)
      if (token === 'mobile') {
        if (scope.kind === 'todos') walkLinksOnly(r)
        continue
      }
      walk(r, segs, scope.kind === 'todos', true)
    }
  }

  function walkLinksOnly(f: BmFolder) {
    for (const c of f.children) {
      if (c.kind === 'folder' && c.id !== trashId) {
        if (prot(c.id)) countProtected(c)
        else { for (const l of c.children) if (l.kind === 'link') addLink(l, c.id); walkLinksOnly(c) }
      }
    }
  }

  // Limite: ficam as mais rasas (empate pela ordem da árvore), na ordem da árvore.
  let kept = all
  if (all.length > MAX_CANDIDATES) {
    const order = all.map((c, i) => ({ c, i })).sort((a, b) => a.c.segments.length - b.c.segments.length || a.i - b.i)
    const keep = new Set(order.slice(0, MAX_CANDIDATES).map((x) => x.i))
    kept = all.filter((_, i) => keep.has(i))
  }
  const candidates = kept.map((c, k) => ({ ...c, k }))
  return { items, candidates, skipped, candidatesCut: all.length - kept.length }
}
