import { toCsv } from './csv'
import { rootToken, type MarksMap } from './marks'
import type { BmNode } from './types'

/** Colunas do CSV da estrutura, nesta ordem. */
export const STRUCTURE_COLUMNS: readonly string[] = [
  'tipo',
  'caminho',
  'titulo',
  'url',
  'ordem',
  'nao_mexer',
  'sugestao',
  'aprovado',
  'raiz',
]

export interface StructureRow {
  tipo: 'pasta' | 'link'
  raiz: 'barra' | 'outros' | 'mobile'
  /** Segmentos do caminho (o primeiro é o nome da raiz). Para link, a pasta que o contém. */
  path: string[]
  title: string
  url: string
  ordem: number
  naoMexer: boolean
  sugestao: string
  aprovado: '' | 'sim' | 'nao'
}

/** `/` vira `\/` e `\` vira `\\` dentro de cada segmento; segmentos são unidos por `/`. */
export function encodePath(segments: string[]): string {
  return segments.map((s) => s.replaceAll('\\', '\\\\').replaceAll('/', '\\/')).join('/')
}

/** Inverso de `encodePath`. Texto vazio dá lista vazia. */
export function decodePath(s: string): string[] {
  if (s === '') return []
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)
    if (ch === '\\' && i + 1 < s.length) {
      cur += s.charAt(i + 1)
      i++
    } else if (ch === '/') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/*
 * Proteção contra injeção de fórmula em planilhas. Colunas protegidas na exportação (e que a
 * importação deve desproteger com `unguardFormula`): `caminho` (a célula inteira, depois de
 * `encodePath`), `titulo`, `url` e `sugestao`. `tipo`, `ordem`, `nao_mexer`, `aprovado` e `raiz`
 * têm valores fixos e não passam pela proteção.
 */
const FORMULA_TRIGGERS = '=+-@'

function isTrigger(ch: string): boolean {
  return ch !== '' && FORMULA_TRIGGERS.includes(ch)
}

/** Primeiro caractere depois dos apóstrofos iniciais ('' se não houver). */
function charAfterApostrophes(v: string): string {
  let i = 0
  while (v.charAt(i) === "'") i++
  return v.charAt(i)
}

/**
 * Põe `'` antes de um valor que comece com `=`, `+`, `-` ou `@`. Para a ida e volta não perder um
 * apóstrofo original, também põe `'` quando o valor já começa com apóstrofos seguidos de um desses
 * quatro (ex.: `'=1` vira `''=1`).
 */
export function guardFormula(v: string): string {
  return isTrigger(charAfterApostrophes(v)) ? `'${v}` : v
}

/**
 * Remove um `'` inicial só quando, depois dos apóstrofos iniciais, vem `=`, `+`, `-` ou `@`
 * (no caso comum, o caractere logo após o `'`). Inverso exato de `guardFormula`.
 */
export function unguardFormula(v: string): string {
  return v.charAt(0) === "'" && isTrigger(charAfterApostrophes(v)) ? v.slice(1) : v
}

function collectRows(tree: BmNode[], marks: MarksMap): StructureRow[] {
  const rows: StructureRow[] = []

  const visit = (n: BmNode, ordem: number, folderPath: string[], raiz: StructureRow['raiz']) => {
    const mark = marks.get(n.id)
    const aprovado: StructureRow['aprovado'] = mark?.aprovado ?? ''
    const common = {
      raiz,
      title: n.title,
      ordem,
      naoMexer: mark?.naoMexer === true,
      sugestao: mark?.sugestao ?? '',
      aprovado,
    }
    if (n.kind === 'folder') {
      const path = [...folderPath, n.title]
      rows.push({ ...common, tipo: 'pasta', path, url: '' })
      n.children.forEach((c, i) => visit(c, i, path, raiz))
    } else {
      rows.push({ ...common, tipo: 'link', path: folderPath, url: n.url })
    }
  }

  // A raiz do Chrome (nó sem pai) não vira linha; suas filhas (Barra, Outros, Mobile) sim.
  for (const top of tree) {
    if (top.kind !== 'folder' || top.parentId !== undefined) continue
    top.children.forEach((child, i) => {
      const raiz = rootToken(tree, child.id)
      if (raiz) visit(child, i, [], raiz)
    })
  }
  return rows
}

/** Exporta a árvore (pré-ordem) e as marcas como CSV da estrutura, com cabeçalho e `\r\n`. */
export function exportStructure(tree: BmNode[], marks: MarksMap): string {
  const body = collectRows(tree, marks).map((r) => [
    r.tipo,
    guardFormula(encodePath(r.path)),
    guardFormula(r.title),
    guardFormula(r.url),
    String(r.ordem),
    r.naoMexer ? 'sim' : '',
    guardFormula(r.sugestao),
    r.aprovado,
    r.raiz,
  ])
  return toCsv([[...STRUCTURE_COLUMNS], ...body])
}
