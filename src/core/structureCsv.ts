import { findTrash } from './cleanup'
import { parseCsv, toCsv } from './csv'
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
  // A Lixeira da extensão não faz parte da estrutura: nem ela nem o que está dentro saem no CSV.
  const trashId = findTrash(tree)?.id

  const visit = (n: BmNode, ordem: number, folderPath: string[], raiz: StructureRow['raiz']) => {
    if (n.id === trashId) return
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

/**
 * Exporta a árvore (pré-ordem) e as marcas como CSV da estrutura, com cabeçalho e `\r\n`. A Lixeira
 * da extensão (`findTrash`) e tudo dentro dela ficam de fora.
 */
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

export interface RowIssue {
  /** Número da linha no CSV lido; o cabeçalho é a linha 1 (ver `parseStructure`). */
  line: number
  message: string
}

const REQUIRED_COLUMNS = ['tipo', 'caminho', 'titulo', 'url', 'raiz'] as const
const ROOTS: readonly StructureRow['raiz'][] = ['barra', 'outros', 'mobile']

function isSupportedUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol
    return p === 'http:' || p === 'https:'
  } catch {
    return false
  }
}

/**
 * Lê o CSV da estrutura (inverso de `exportStructure`). As colunas são achadas pelo nome do
 * cabeçalho (sem diferenciar maiúsculas, ignorando espaços nas pontas), em qualquer ordem; colunas
 * desconhecidas são ignoradas. `tipo`, `caminho`, `titulo`, `url` e `raiz` são obrigatórias: se
 * faltar alguma, vem `fatal` e `rows` vazio. Linhas com todos os campos vazios (sobras de planilha)
 * são puladas sem aviso; as demais com problema geram um `RowIssue` e são descartadas (exceto
 * `aprovado` inválido, que só perde o `aprovado`).
 *
 * `line` é o índice da linha entre as linhas lidas pelo `parseCsv` mais 1: o cabeçalho é a linha 1 e
 * a primeira linha de dados é a 2. Como o `parseCsv` já descarta linhas sem nenhum caractere, o
 * número pode ficar abaixo do da planilha quando houver essas linhas; linhas como `,,,,` contam.
 * Quando `ordem` não é um inteiro não negativo, vale a posição de aparição: o índice da linha de
 * dados entre as linhas lidas, a partir de 0 (a primeira linha de dados é 0), ou seja `line - 2`.
 */
export function parseStructure(text: string): { rows: StructureRow[]; issues: RowIssue[]; fatal?: string } {
  const table = parseCsv(text)
  const header = table[0]
  if (!header) return { rows: [], issues: [], fatal: 'Arquivo vazio.' }

  const col = new Map<string, number>()
  header.forEach((name, i) => {
    const key = name.trim().toLowerCase()
    if (!col.has(key)) col.set(key, i)
  })
  const missing = REQUIRED_COLUMNS.filter((c) => !col.has(c))
  if (missing.length > 0) {
    const names = missing.join(', ')
    return {
      rows: [],
      issues: [],
      fatal: missing.length === 1 ? `Falta a coluna obrigatória: ${names}.` : `Faltam colunas obrigatórias: ${names}.`,
    }
  }

  const rows: StructureRow[] = []
  const issues: RowIssue[] = []

  for (let idx = 1; idx < table.length; idx++) {
    const cells = table[idx] ?? []
    if (cells.every((c) => c.trim() === '')) continue
    const line = idx + 1
    const get = (name: string): string => {
      const i = col.get(name)
      return i === undefined ? '' : (cells[i] ?? '')
    }
    const reject = (message: string) => issues.push({ line, message })

    const tipo = get('tipo').trim().toLowerCase()
    if (tipo !== 'pasta' && tipo !== 'link') {
      reject(`Tipo inválido: "${get('tipo').trim()}" (use pasta ou link).`)
      continue
    }
    const raiz = ROOTS.find((r) => r === get('raiz').trim().toLowerCase())
    if (!raiz) {
      reject(`Raiz desconhecida: "${get('raiz').trim()}" (use barra, outros ou mobile).`)
      continue
    }
    const path = decodePath(unguardFormula(get('caminho')))
    if (path.length === 0) {
      reject('Caminho vazio.')
      continue
    }
    const url = unguardFormula(get('url')).trim()
    if (tipo === 'link' && !isSupportedUrl(url)) {
      reject(url === '' ? 'URL não suportada: o link está sem URL.' : `URL não suportada: ${url}`)
      continue
    }

    const ordemText = get('ordem').trim()
    const ordem = /^\d+$/.test(ordemText) ? Number(ordemText) : idx - 1

    const aprovadoText = get('aprovado').trim().toLowerCase()
    let aprovado: StructureRow['aprovado'] = ''
    if (aprovadoText === 'sim' || aprovadoText === 'nao') aprovado = aprovadoText
    else if (aprovadoText !== '') reject(`Valor de aprovado inválido: "${get('aprovado').trim()}" (use sim, nao ou deixe vazio); ignorado.`)

    rows.push({
      tipo,
      raiz,
      path,
      title: unguardFormula(get('titulo')),
      url: tipo === 'link' ? url : '',
      ordem,
      naoMexer: get('nao_mexer').trim().toLowerCase() === 'sim',
      sugestao: unguardFormula(get('sugestao')),
      aprovado,
    })
  }
  return { rows, issues }
}
