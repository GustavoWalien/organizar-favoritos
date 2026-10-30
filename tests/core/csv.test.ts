import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from '../../src/core/csv'

describe('toCsv', () => {
  it('usa \\r\\n e só põe aspas quando preciso', () => {
    expect(toCsv([['a', 'b c'], ['1', '2']])).toBe('a,b c\r\n1,2')
  })

  it('escapa vírgula, aspas duplas e quebra de linha', () => {
    expect(toCsv([['a,b', 'diz "oi"', 'x\ny', 'z\r\nw']])).toBe('"a,b","diz ""oi""","x\ny","z\r\nw"')
  })
})

describe('parseCsv', () => {
  it('ida e volta com vírgula, aspas, quebra, acentos e emoji', () => {
    const rows = [
      ['tipo', 'título'],
      ['a,b', 'diz "oi"'],
      ['linha1\nlinha2', 'ação ✓ 😀'],
      ['', 'x'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })

  it('ignora o BOM no início', () => {
    expect(parseCsv('﻿a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('aceita \\n simples como fim de linha', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('aceita última linha sem quebra', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('descarta linhas em branco no fim e no meio', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n\r\n\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('preserva campo vazio entre vírgulas e no fim', () => {
    expect(parseCsv('a,,c\r\n,,\r\n1,2,')).toEqual([['a', '', 'c'], ['', '', ''], ['1', '2', '']])
  })

  it('campo entre aspas com vírgula, "" e quebras', () => {
    expect(parseCsv('"a,b","c ""d""","e\r\nf"\r\nx,y,z')).toEqual([['a,b', 'c "d"', 'e\r\nf'], ['x', 'y', 'z']])
  })

  it('texto vazio dá nenhuma linha', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('﻿')).toEqual([])
  })
})
