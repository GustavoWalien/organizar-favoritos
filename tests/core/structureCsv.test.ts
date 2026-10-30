import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/core/csv'
import type { MarksMap } from '../../src/core/marks'
import {
  decodePath,
  encodePath,
  exportStructure,
  guardFormula,
  STRUCTURE_COLUMNS,
  unguardFormula,
} from '../../src/core/structureCsv'
import type { BmNode } from '../../src/core/types'
import { sampleTree } from '../fixtures/sampleTree'

const rowsOf = (tree: BmNode[], marks: MarksMap = new Map()) => parseCsv(exportStructure(tree, marks))
const find = (rows: string[][], tipo: string, titulo: string) => rows.find((r) => r[0] === tipo && r[2] === titulo)

describe('exportStructure', () => {
  it('cabeçalho exato', () => {
    expect(STRUCTURE_COLUMNS.join(',')).toBe('tipo,caminho,titulo,url,ordem,nao_mexer,sugestao,aprovado,raiz')
    expect(exportStructure(sampleTree, new Map()).split('\r\n')[0]).toBe('tipo,caminho,titulo,url,ordem,nao_mexer,sugestao,aprovado,raiz')
  })

  it('a raiz do Chrome não vira linha; percorre em pré-ordem', () => {
    const rows = rowsOf(sampleTree)
    expect(rows.map((r) => r[2])).toEqual(['titulo', 'Barra de favoritos', 'Dev', 'MDN', 'GitHub', 'Outros favoritos', 'Exemplo', 'Favoritos para dispositivos móveis'])
  })

  it('pasta Dev: tipo pasta, caminho com a raiz, raiz=barra', () => {
    expect(find(rowsOf(sampleTree), 'pasta', 'Dev')).toEqual(['pasta', 'Barra de favoritos/Dev', 'Dev', '', '0', '', '', '', 'barra'])
  })

  it('link MDN: caminho é a pasta que o contém, URL completa, ordem 0', () => {
    const rows = rowsOf(sampleTree)
    expect(find(rows, 'link', 'MDN')).toEqual(['link', 'Barra de favoritos/Dev', 'MDN', 'https://developer.mozilla.org/', '0', '', '', '', 'barra'])
    expect(find(rows, 'link', 'GitHub')?.[4]).toBe('1')
  })

  it('link direto em Outros tem caminho da raiz', () => {
    const r = find(rowsOf(sampleTree), 'link', 'Exemplo')
    expect(r?.[1]).toBe('Outros favoritos')
    expect(r?.[8]).toBe('outros')
  })

  it('pasta vazia (Mobile) aparece', () => {
    expect(find(rowsOf(sampleTree), 'pasta', 'Favoritos para dispositivos móveis')).toEqual([
      'pasta', 'Favoritos para dispositivos móveis', 'Favoritos para dispositivos móveis', '', '2', '', '', '', 'mobile',
    ])
  })

  it('marca naoMexer só na linha da pasta, nunca nos descendentes', () => {
    const rows = rowsOf(sampleTree, new Map([['5', { id: '5', naoMexer: true }]]))
    expect(find(rows, 'pasta', 'Dev')?.[5]).toBe('sim')
    expect(find(rows, 'link', 'MDN')?.[5]).toBe('')
    expect(find(rows, 'link', 'GitHub')?.[5]).toBe('')
  })

  it('exporta sugestão e aprovado', () => {
    const rows = rowsOf(sampleTree, new Map([
      ['10', { id: '10', sugestao: 'Referência', aprovado: 'sim' as const }],
      ['11', { id: '11', aprovado: 'nao' as const }],
    ]))
    const mdn = find(rows, 'link', 'MDN')
    expect(mdn?.[6]).toBe('Referência')
    expect(mdn?.[7]).toBe('sim')
    expect(find(rows, 'link', 'GitHub')?.[7]).toBe('nao')
  })

  it('título com / e \\ é escapado em caminho', () => {
    const tree: BmNode[] = [{
      kind: 'folder', id: '0', title: '', children: [
        { kind: 'folder', id: '1', parentId: '0', title: 'Barra de favoritos', children: [
          { kind: 'folder', id: '7', parentId: '1', title: 'Foo/Bar\\Baz', children: [] },
        ] },
      ],
    }]
    const r = find(rowsOf(tree), 'pasta', 'Foo/Bar\\Baz')
    expect(r?.[1]).toBe('Barra de favoritos/Foo\\/Bar\\\\Baz')
  })

  it('título que começa com = sai protegido contra fórmula', () => {
    const tree: BmNode[] = [{
      kind: 'folder', id: '0', title: '', children: [
        { kind: 'folder', id: '2', parentId: '0', title: 'Outros favoritos', children: [
          { kind: 'link', id: '30', parentId: '2', title: '=SOMA(A1)', url: '=cmd|x', dateAdded: 1 },
        ] },
      ],
    }]
    const r = find(rowsOf(tree), 'link', "'=SOMA(A1)")
    expect(r?.[2]).toBe("'=SOMA(A1)")
    expect(r?.[3]).toBe("'=cmd|x")
  })

  it('sugestão que começa com = também é protegida', () => {
    const rows = rowsOf(sampleTree, new Map([['10', { id: '10', sugestao: '=x' }]]))
    expect(find(rows, 'link', 'MDN')?.[6]).toBe("'=x")
  })
})

describe('caminho', () => {
  it('decodePath(encodePath(x)) devolve x', () => {
    for (const x of [['a'], ['a', 'b/c', 'd\\e'], ['\\', '/'], ['a\\/b'], ['', 'x'], ['//', '\\\\']]) {
      expect(decodePath(encodePath(x))).toEqual(x)
    }
  })

  it('codifica barra e contrabarra', () => {
    expect(encodePath(['A', 'B/C', 'D\\E'])).toBe('A/B\\/C/D\\\\E')
  })
})

describe('guardFormula / unguardFormula', () => {
  it('põe apóstrofo antes de = + - @', () => {
    for (const c of ['=', '+', '-', '@']) expect(guardFormula(`${c}1`)).toBe(`'${c}1`)
    expect(guardFormula('abc')).toBe('abc')
    expect(guardFormula('')).toBe('')
  })

  it("unguardFormula remove ' só antes de = + - @", () => {
    expect(unguardFormula("'=1")).toBe('=1')
    expect(unguardFormula("'abc")).toBe("'abc")
    expect(unguardFormula("'x")).toBe("'x")
    expect(unguardFormula("'")).toBe("'")
  })

  it('ida e volta sem perda, inclusive com apóstrofo já presente', () => {
    for (const v of ['=1', '+a', '-5', '@x', "'=1", "''=1", "'abc", 'abc', '', "'"]) {
      expect(unguardFormula(guardFormula(v))).toBe(v)
    }
  })
})
