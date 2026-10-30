import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/core/csv'
import type { MarksMap } from '../../src/core/marks'
import {
  decodePath,
  encodePath,
  exportStructure,
  guardFormula,
  parseStructure,
  type StructureRow,
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

describe('parseStructure', () => {
  const HEAD = STRUCTURE_COLUMNS.join(',')
  const csv = (...lines: string[]) => [HEAD, ...lines].join('\r\n')
  const row = (over: Partial<StructureRow>): StructureRow => ({
    tipo: 'link', raiz: 'barra', path: ['Barra de favoritos'], title: 't', url: 'https://a.com/', ordem: 0,
    naoMexer: false, sugestao: '', aprovado: '', ...over,
  })

  it('ida e volta: o CSV exportado de sampleTree volta com as mesmas linhas, com marcas', () => {
    const marks: MarksMap = new Map([
      ['5', { id: '5', naoMexer: true }],
      ['10', { id: '10', sugestao: 'Referência', aprovado: 'sim' as const }],
      ['11', { id: '11', aprovado: 'nao' as const }],
    ])
    const r = parseStructure(exportStructure(sampleTree, marks))
    expect(r.fatal).toBeUndefined()
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([
      row({ tipo: 'pasta', path: ['Barra de favoritos'], title: 'Barra de favoritos', url: '', ordem: 0 }),
      row({ tipo: 'pasta', path: ['Barra de favoritos', 'Dev'], title: 'Dev', url: '', ordem: 0, naoMexer: true }),
      row({ path: ['Barra de favoritos', 'Dev'], title: 'MDN', url: 'https://developer.mozilla.org/', ordem: 0, sugestao: 'Referência', aprovado: 'sim' }),
      row({ path: ['Barra de favoritos', 'Dev'], title: 'GitHub', url: 'https://github.com/', ordem: 1, aprovado: 'nao' }),
      row({ tipo: 'pasta', raiz: 'outros', path: ['Outros favoritos'], title: 'Outros favoritos', url: '', ordem: 1 }),
      row({ raiz: 'outros', path: ['Outros favoritos'], title: 'Exemplo', url: 'https://example.com/', ordem: 0 }),
      row({ tipo: 'pasta', raiz: 'mobile', path: ['Favoritos para dispositivos móveis'], title: 'Favoritos para dispositivos móveis', url: '', ordem: 2 }),
    ])
  })

  it('ida e volta com título/caminho/URL perigosos (barra, contrabarra, =, apóstrofos, vírgula, aspas)', () => {
    const tree: BmNode[] = [{
      kind: 'folder', id: '0', title: '', children: [
        { kind: 'folder', id: '1', parentId: '0', title: 'Barra de favoritos', children: [
          { kind: 'folder', id: '7', parentId: '1', title: '=Foo/Bar\\Baz', children: [
            { kind: 'link', id: '8', parentId: '7', title: "''=x, \"y\"", url: 'https://a.com/?q=1,2', dateAdded: 1 },
          ] },
        ] },
      ],
    }]
    const marks: MarksMap = new Map([['8', { id: '8', sugestao: '-Sugestão/Pasta' }]])
    const r = parseStructure(exportStructure(tree, marks))
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([
      row({ tipo: 'pasta', path: ['Barra de favoritos'], title: 'Barra de favoritos', url: '', ordem: 0 }),
      row({ tipo: 'pasta', path: ['Barra de favoritos', '=Foo/Bar\\Baz'], title: '=Foo/Bar\\Baz', url: '', ordem: 0 }),
      row({ path: ['Barra de favoritos', '=Foo/Bar\\Baz'], title: "''=x, \"y\"", url: 'https://a.com/?q=1,2', ordem: 0, sugestao: '-Sugestão/Pasta' }),
    ])
  })

  it('lê as colunas pelo nome do cabeçalho, em qualquer ordem e sem diferenciar maiúsculas', () => {
    const text = 'RAIZ, URL ,Titulo,caminho,tipo\r\nbarra,https://a.com/,A,Barra de favoritos,link'
    const r = parseStructure(text)
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([row({ title: 'A', url: 'https://a.com/' })])
  })

  it('coluna extra desconhecida é ignorada', () => {
    const text = `${HEAD},comentario\r\nlink,Barra de favoritos,A,https://a.com/,3,,,,barra,olá`
    const r = parseStructure(text)
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([row({ title: 'A', ordem: 3 })])
  })

  it('falta uma coluna obrigatória: fatal citando a coluna e rows vazio', () => {
    for (const col of ['tipo', 'caminho', 'titulo', 'url', 'raiz']) {
      const head = STRUCTURE_COLUMNS.filter((c) => c !== col).join(',')
      const r = parseStructure(`${head}\r\nx`)
      expect(r.fatal).toContain(col)
      expect(r.rows).toEqual([])
    }
  })

  it('ordem, nao_mexer, sugestao e aprovado são opcionais no cabeçalho', () => {
    const r = parseStructure('tipo,caminho,titulo,url,raiz\r\nlink,Barra de favoritos,A,https://a.com/,barra')
    expect(r.fatal).toBeUndefined()
    expect(r.rows).toEqual([row({ title: 'A' })])
  })

  it('tipo inválido: issue na linha certa (cabeçalho é a 1) e as outras seguem', () => {
    const r = parseStructure(csv(
      'link,Barra de favoritos,A,https://a.com/,0,,,,barra',
      'foo,Barra de favoritos,B,https://b.com/,1,,,,barra',
      'link,Barra de favoritos,C,https://c.com/,2,,,,barra',
    ))
    expect(r.rows.map((x) => x.title)).toEqual(['A', 'C'])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]?.line).toBe(3)
    expect(r.issues[0]?.message).toContain('foo')
  })

  it('raiz desconhecida: issue e a linha é descartada', () => {
    const r = parseStructure(csv('link,Barra de favoritos,A,https://a.com/,0,,,,lua', 'link,Barra de favoritos,B,https://b.com/,1,,,,barra'))
    expect(r.rows.map((x) => x.title)).toEqual(['B'])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]?.line).toBe(2)
    expect(r.issues[0]?.message).toContain('lua')
  })

  it('caminho vazio: issue e a linha é descartada', () => {
    const r = parseStructure(csv('link,,A,https://a.com/,0,,,,barra'))
    expect(r.rows).toEqual([])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]?.line).toBe(2)
  })

  it('ordem não numérica ou vazia vira a posição de aparição (índice da linha de dados, base 0), sem issue', () => {
    const r = parseStructure(csv(
      'link,Barra de favoritos,A,https://a.com/,5,,,,barra',
      'link,Barra de favoritos,B,https://b.com/,abc,,,,barra',
      'link,Barra de favoritos,C,https://c.com/,,,,,barra',
      'link,Barra de favoritos,D,https://d.com/,-1,,,,barra',
    ))
    expect(r.issues).toEqual([])
    expect(r.rows.map((x) => x.ordem)).toEqual([5, 1, 2, 3])
  })

  it('aprovado inválido: issue e a linha segue sem aprovado', () => {
    const r = parseStructure(csv('link,Barra de favoritos,A,https://a.com/,0,,,talvez,barra'))
    expect(r.rows).toEqual([row({ title: 'A' })])
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]?.line).toBe(2)
    expect(r.issues[0]?.message).toContain('talvez')
  })

  it('aprovado aceita sim/nao em qualquer caixa; vazio não gera issue', () => {
    const r = parseStructure(csv(
      'link,Barra de favoritos,A,https://a.com/,0,,,SIM,barra',
      'link,Barra de favoritos,B,https://b.com/,1,,,Nao,barra',
      'link,Barra de favoritos,C,https://c.com/,2,,,,barra',
    ))
    expect(r.issues).toEqual([])
    expect(r.rows.map((x) => x.aprovado)).toEqual(['sim', 'nao', ''])
  })

  it('nao_mexer aceita sim/SIM/Sim; qualquer outro valor vale como vazio', () => {
    const r = parseStructure(csv(
      'link,Barra de favoritos,A,https://a.com/,0,sim,,,barra',
      'link,Barra de favoritos,B,https://b.com/,1,SIM,,,barra',
      'link,Barra de favoritos,C,https://c.com/,2,Sim,,,barra',
      'link,Barra de favoritos,D,https://d.com/,3,talvez,,,barra',
      'link,Barra de favoritos,E,https://e.com/,4,1,,,barra',
    ))
    expect(r.issues).toEqual([])
    expect(r.rows.map((x) => x.naoMexer)).toEqual([true, true, true, false, false])
  })

  it('URL não suportada em link: issue e a linha é descartada', () => {
    const r = parseStructure(csv(
      'link,Barra de favoritos,A,chrome://settings,0,,,,barra',
      'link,Barra de favoritos,B,javascript:alert(1),1,,,,barra',
      'link,Barra de favoritos,C,ftp://x.com/,2,,,,barra',
      'link,Barra de favoritos,D,não é url,3,,,,barra',
      'link,Barra de favoritos,E,,4,,,,barra',
      'link,Barra de favoritos,F,https://f.com/,5,,,,barra',
    ))
    expect(r.rows.map((x) => x.title)).toEqual(['F'])
    expect(r.issues.map((i) => i.line)).toEqual([2, 3, 4, 5, 6])
    expect(r.issues[0]?.message).toContain('URL não suportada')
    expect(r.issues[1]?.message).toContain('URL não suportada')
  })

  it('pasta não precisa de URL', () => {
    const r = parseStructure(csv('pasta,Barra de favoritos/Dev,Dev,,0,,,,barra'))
    expect(r.issues).toEqual([])
    expect(r.rows).toEqual([row({ tipo: 'pasta', path: ['Barra de favoritos', 'Dev'], title: 'Dev', url: '' })])
  })

  it('arquivo vazio: rows vazio; só cabeçalho: rows vazio e sem fatal', () => {
    const vazio = parseStructure('')
    expect(vazio.rows).toEqual([])
    expect(vazio.fatal).toBeDefined()
    const soCab = parseStructure(HEAD)
    expect(soCab.rows).toEqual([])
    expect(soCab.issues).toEqual([])
    expect(soCab.fatal).toBeUndefined()
  })

  it('linhas totalmente vazias (",,,,,") são ignoradas sem issue', () => {
    const r = parseStructure(csv(',,,,,,,,', 'link,Barra de favoritos,A,https://a.com/,0,,,,barra', ' , , , ,,,,,'))
    expect(r.issues).toEqual([])
    expect(r.rows.map((x) => x.title)).toEqual(['A'])
  })

  it('a linha de uma issue conta pelas linhas lidas (cabeçalho = 1), mesmo depois de linhas em branco de ,,,', () => {
    const r = parseStructure(csv(',,,,,,,,', 'foo,Barra de favoritos,A,https://a.com/,0,,,,barra'))
    expect(r.issues[0]?.line).toBe(3)
  })

  it('aceita BOM e fim de linha \\n', () => {
    const r = parseStructure('\ufeff' + HEAD + '\nlink,Barra de favoritos,A,https://a.com/,0,,,,barra\n')
    expect(r.issues).toEqual([])
    expect(r.rows).toHaveLength(1)
  })
})
