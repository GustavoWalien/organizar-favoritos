import { describe, expect, it, vi } from 'vitest'
import { loadViewMode, parseViewMode, saveViewMode } from '../../src/ui/viewMode'

describe('modo de visualização', () => {
  it('parseViewMode aceita os três modos e cai para lista', () => {
    expect(parseViewMode('cards')).toBe('cards')
    expect(parseViewMode('compacto')).toBe('compacto')
    expect(parseViewMode('lista')).toBe('lista')
    expect(parseViewMode('grade')).toBe('lista')
    expect(parseViewMode(null)).toBe('lista')
  })
  it('loadViewMode e saveViewMode toleram storage com erro', () => {
    expect(loadViewMode({ getItem: () => 'cards' })).toBe('cards')
    expect(loadViewMode({ getItem: () => { throw new Error('bloqueado') } })).toBe('lista')
    expect(loadViewMode(undefined)).toBe('lista')
    const setItem = vi.fn()
    saveViewMode('compacto', { setItem })
    expect(setItem).toHaveBeenCalledWith('viewMode', 'compacto')
    expect(() => saveViewMode('cards', { setItem: () => { throw new Error('x') } })).not.toThrow()
  })
})
