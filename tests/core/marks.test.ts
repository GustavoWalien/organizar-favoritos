import { describe, expect, it } from 'vitest'
import { isProtectedEffective, patchMark, rootToken, type ItemMark, type MarksMap } from '../../src/core/marks'
import { sampleTree } from '../fixtures/sampleTree'

const marks = (...list: ItemMark[]): MarksMap => new Map(list.map((m) => [m.id, m]))

describe('isProtectedEffective', () => {
  it('marca própria protege e conta como própria', () => {
    expect(isProtectedEffective(sampleTree, marks({ id: '10', naoMexer: true }), '10')).toEqual({ protected: true, own: true })
  })

  it('filho de pasta marcada, dois níveis abaixo, é protegido pela pasta', () => {
    expect(isProtectedEffective(sampleTree, marks({ id: '1', naoMexer: true }), '10')).toEqual({
      protected: true,
      own: false,
      byFolderId: '1',
    })
  })

  it('usa a pasta marcada mais próxima', () => {
    const m = marks({ id: '1', naoMexer: true }, { id: '5', naoMexer: true })
    expect(isProtectedEffective(sampleTree, m, '10').byFolderId).toBe('5')
  })

  it('sem marca não protege', () => {
    expect(isProtectedEffective(sampleTree, marks(), '10').protected).toBe(false)
  })

  it('marca sem naoMexer não protege', () => {
    expect(isProtectedEffective(sampleTree, marks({ id: '10', sugestao: 'x' }, { id: '5', aprovado: 'sim' }), '10').protected).toBe(false)
  })

  it('id inexistente não é protegido', () => {
    expect(isProtectedEffective(sampleTree, marks({ id: '1', naoMexer: true }), '999').protected).toBe(false)
  })
})

describe('patchMark', () => {
  it('cria a marca com os campos informados', () => {
    expect(patchMark(undefined, '10', { naoMexer: true })).toEqual({ id: '10', naoMexer: true })
  })

  it('campo vazio ou undefined não apaga o que existe', () => {
    const prev: ItemMark = { id: '10', naoMexer: true, sugestao: 'Dev' }
    expect(patchMark(prev, '10', { sugestao: '', aprovado: undefined })).toEqual({ id: '10', naoMexer: true, sugestao: 'Dev' })
  })

  it('naoMexer:false explícito remove só esse campo', () => {
    const prev: ItemMark = { id: '10', naoMexer: true, sugestao: 'Dev' }
    expect(patchMark(prev, '10', { naoMexer: false })).toEqual({ id: '10', sugestao: 'Dev' })
  })

  it('resultado sem campos devolve undefined', () => {
    expect(patchMark({ id: '10', naoMexer: true }, '10', { naoMexer: false })).toBeUndefined()
    expect(patchMark(undefined, '10', { sugestao: '' })).toBeUndefined()
  })

  it('aplica sugestão e aprovado', () => {
    expect(patchMark({ id: '10', naoMexer: true }, '10', { sugestao: 'A/B', aprovado: 'nao' })).toEqual({
      id: '10',
      naoMexer: true,
      sugestao: 'A/B',
      aprovado: 'nao',
    })
  })
})

describe('rootToken', () => {
  it('ids 1, 2 e 3 viram barra, outros e mobile', () => {
    expect(rootToken(sampleTree, '1')).toBe('barra')
    expect(rootToken(sampleTree, '2')).toBe('outros')
    expect(rootToken(sampleTree, '3')).toBe('mobile')
  })

  it('pasta que não é raiz devolve undefined', () => {
    expect(rootToken(sampleTree, '5')).toBeUndefined()
    expect(rootToken(sampleTree, '999')).toBeUndefined()
  })

  it('ids diferentes usam a posição entre as filhas da raiz', () => {
    const tree = [
      {
        kind: 'folder' as const, id: '0', title: '', children: [
          { kind: 'folder' as const, id: 'a', parentId: '0', title: 'A', children: [] },
          { kind: 'folder' as const, id: 'b', parentId: '0', title: 'B', children: [] },
          { kind: 'folder' as const, id: 'c', parentId: '0', title: 'C', children: [] },
        ],
      },
    ]
    expect(rootToken(tree, 'a')).toBe('barra')
    expect(rootToken(tree, 'b')).toBe('outros')
    expect(rootToken(tree, 'c')).toBe('mobile')
  })
})
