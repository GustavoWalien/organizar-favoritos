import { describe, expect, it } from 'vitest'
import { clear, filterByReason, mergeCandidates, selectAll, toggleOne, visibleSelection, type Candidate } from '../../src/ui/selection'

const c = (id: string, ...reasons: Candidate['reasons']): Candidate => ({ id, title: id, url: `https://${id}.com/`, path: [], reasons })

describe('seleção', () => {
  it('toggleOne adiciona e remove sem mutar o conjunto original', () => {
    const original = new Set(['a'])
    const added = toggleOne(original, 'b')
    expect([...added].sort()).toEqual(['a', 'b'])
    expect([...original]).toEqual(['a'])
    expect([...toggleOne(added, 'a')]).toEqual(['b'])
  })

  it('selectAll de uma lista filtrada não seleciona itens fora do filtro', () => {
    const items = [c('a', 'quebrado'), c('b', 'sem-uso'), c('d', 'quebrado')]
    expect([...selectAll(filterByReason(items, 'quebrado'))].sort()).toEqual(['a', 'd'])
  })

  it('itens só incerto ficam de fora do "selecionar todos"', () => {
    const items = [c('a', 'quebrado'), c('b', 'incerto'), c('d', 'incerto', 'sem-uso')]
    expect([...selectAll(items)].sort()).toEqual(['a', 'd'])
    expect(selectAll(filterByReason(items, 'incerto')).has('b')).toBe(false)
  })

  it('clear devolve um conjunto vazio', () => {
    expect(clear().size).toBe(0)
  })

  it('filterByReason "todos" devolve tudo', () => {
    const items = [c('a', 'quebrado'), c('b', 'sem-uso')]
    expect(filterByReason(items, 'todos')).toEqual(items)
  })

  it('mergeCandidates junta os motivos do mesmo favorito e mantém a ordem da primeira aparição', () => {
    const merged = mergeCandidates([c('a', 'sem-uso'), c('b', 'duplicado'), c('a', 'quebrado')])
    expect(merged.map((m) => m.id)).toEqual(['a', 'b'])
    expect(merged[0]!.reasons).toEqual(['sem-uso', 'quebrado'])
  })
})

describe('visibleSelection', () => {
  it('só os marcados que ainda estão na lista vão para a Lixeira', () => {
    const list = [c('a', 'sem-uso'), c('b', 'sem-uso')]
    expect(visibleSelection(new Set(['a', 'b', 'sumiu', 'outra-aba']), list).sort()).toEqual(['a', 'b'])
    expect(visibleSelection(new Set(['x']), list)).toEqual([])
  })
})
