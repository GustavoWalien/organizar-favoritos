import { describe, expect, it } from 'vitest'
import { makeBatches } from '../../src/ai/prompt'
import { buildScope } from '../../src/ai/scope'
import { InvalidResponseError, validateResponse } from '../../src/ai/validate'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const lnk = (id: string, parentId: string): BmLink => ({ kind: 'link', id, parentId, title: id, url: `https://${id}.example/`, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const tree: BmNode[] = [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [dir('10', '1', 'Dev', [dir('11', '10', 'Ferramentas Úteis')]), lnk('a', '1'), lnk('b', '1'), lnk('c', '1')]),
    dir('2', '0', 'Outros', []),
  ]),
]
const scope = buildScope(tree, new Map(), { kind: 'sem-categoria', allowNew: true })
const batch = makeBatches(scope.items)[0]! // a=0, b=1, c=2
const cands = scope.candidates // 0 Barra(raiz), 1 Dev, 2 Ferramentas Úteis, 3 Outros(raiz)
const run = (itens: unknown[], allowNew = true) => validateResponse(JSON.stringify({ itens }), batch, cands, allowNew, tree)
const it0 = (p: Record<string, unknown>) => ({ i: 0, pasta: 1, nova: '', confianca: 'alta', motivo: 'ok', ...p })

describe('validateResponse', () => {
  it('formato inválido lança', () => {
    expect(() => validateResponse('não é json', batch, cands, true, tree)).toThrow(InvalidResponseError)
    expect(() => validateResponse('{"x":1}', batch, cands, true, tree)).toThrow(InvalidResponseError)
    expect(() => validateResponse('{"itens":[{"i":0,"pasta":1', batch, cands, true, tree)).toThrow(InvalidResponseError)
  })

  it('item válido para pasta existente', () => {
    const r = run([it0({})])
    expect(r.suggestions).toEqual([{ itemId: 'a', folderId: '10', newPath: [], confidence: 'alta', reason: 'ok' }])
    expect(r.missing.sort()).toEqual(['b', 'c'])
  })

  it('i repetido vale o primeiro; i fora do lote é ignorado', () => {
    const r = run([it0({ pasta: 1 }), it0({ pasta: 2 }), it0({ i: 99 })])
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0]!.folderId).toBe('10')
  })

  it('pasta fora das candidatas e raiz sem nova: sem sugestão', () => {
    const r = run([it0({ pasta: 42 }), it0({ i: 1, pasta: 0 })])
    expect(r.suggestions).toEqual([])
    expect(r.missing.sort()).toEqual(['a', 'b', 'c'])
  })

  it('nova: espaços, corte em 2 níveis, "../" como texto', () => {
    const r = run([it0({ nova: '   ' }), it0({ i: 1, pasta: 0, nova: 'a / b / c' }), it0({ i: 2, pasta: 0, nova: '../x' })])
    expect(r.suggestions.map((s) => [s.itemId, s.folderId, s.newPath])).toEqual([
      ['a', '10', []],
      ['b', '1', ['a', 'b']],
      ['c', '1', ['../x']],
    ])
  })

  it('nova que já existe vira pasta existente (sem acento e maiúscula)', () => {
    const r = run([it0({ nova: 'ferramentas uteis' }), it0({ i: 1, nova: 'Ferramentas Úteis / Novas' })])
    expect(r.suggestions[0]).toMatchObject({ folderId: '11', newPath: [] })
    expect(r.suggestions[1]).toMatchObject({ folderId: '11', newPath: ['Novas'] })
  })

  it('criar proibido: nova que não resolve fica sem sugestão', () => {
    const r = run([it0({ nova: 'Nova' }), it0({ i: 1, nova: 'Ferramentas Úteis' })], false)
    expect(r.suggestions.map((s) => [s.itemId, s.folderId])).toEqual([['b', '11']])
  })

  it('confiança desconhecida vira baixa; motivo cortado em 60; nomes cortados em 60', () => {
    const r = run([it0({ confianca: 'talvez', motivo: 'm'.repeat(100), nova: 'n'.repeat(80) })])
    expect(r.suggestions[0]!.confidence).toBe('baixa')
    expect(r.suggestions[0]!.reason).toHaveLength(60)
    expect(r.suggestions[0]!.newPath[0]).toHaveLength(60)
  })

  it('item malformado dentro da lista é ignorado sem derrubar o lote', () => {
    const r = run([{ i: 'zero' }, null, it0({ i: 1 })])
    expect(r.suggestions.map((s) => s.itemId)).toEqual(['b'])
  })
})
