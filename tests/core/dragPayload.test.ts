import { describe, expect, it } from 'vitest'
import { decodeDrag, DRAG_MIME, encodeDrag, idsToDrag } from '../../src/core/dragPayload'

describe('dragPayload', () => {
  it('tem um tipo próprio, para não confundir com arrastar links ou texto de outros sites', () => {
    expect(DRAG_MIME).toBe('application/x-organizar-favoritos')
  })

  it('encode/decode ida e volta', () => {
    expect(decodeDrag(encodeDrag(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('decodeDrag devolve [] para lixo: texto solto, objeto, array com número, vazio', () => {
    for (const raw of ['', 'oi', '{"a":1}', '[1,2]', '["a",2]', 'null', '"a"']) {
      expect(decodeDrag(raw), raw).toEqual([])
    }
  })

  it('idsToDrag: arrastar um item selecionado leva toda a seleção', () => {
    expect(idsToDrag('a', new Set(['b', 'a', 'c']))).toEqual(['b', 'a', 'c'])
  })

  it('idsToDrag: arrastar um item fora da seleção leva só ele', () => {
    expect(idsToDrag('z', new Set(['a', 'b']))).toEqual(['z'])
    expect(idsToDrag('z', new Set())).toEqual(['z'])
  })
})
