import { describe, expect, it } from 'vitest'
import { lockedFolderIds, protectMessage } from '../../src/core/organize'
import type { ItemMark, MarksMap } from '../../src/core/marks'

const marks = (...list: ItemMark[]): MarksMap => new Map(list.map((m) => [m.id, m]))

describe('lockedFolderIds', () => {
  it('devolve só os ids com naoMexer', () => {
    const m = marks({ id: 'a', naoMexer: true }, { id: 'b', sugestao: 'X' }, { id: 'c', naoMexer: false }, { id: 'd', naoMexer: true, aprovado: 'sim' })
    expect([...lockedFolderIds(m)].sort()).toEqual(['a', 'd'])
  })

  it('mapa vazio dá conjunto vazio', () => {
    expect(lockedFolderIds(new Map()).size).toBe(0)
  })
})

describe('protectMessage', () => {
  it('marcar, singular e plural', () => {
    expect(protectMessage(1, true)).toBe('1 favorito marcado como não mexer')
    expect(protectMessage(3, true)).toBe('3 favoritos marcados como não mexer')
  })

  it('liberar, singular e plural', () => {
    expect(protectMessage(1, false)).toBe('1 favorito liberado')
    expect(protectMessage(2, false)).toBe('2 favoritos liberados')
  })

  it('pastas', () => {
    expect(protectMessage(1, true, 'pasta')).toBe('1 pasta marcada como não mexer')
    expect(protectMessage(2, true, 'pasta')).toBe('2 pastas marcadas como não mexer')
    expect(protectMessage(1, false, 'pasta')).toBe('1 pasta liberada')
    expect(protectMessage(2, false, 'pasta')).toBe('2 pastas liberadas')
  })
})
