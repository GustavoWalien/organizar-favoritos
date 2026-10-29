import { describe, expect, it, vi } from 'vitest'
import { applyTheme, loadPref, parsePref, resolveTheme, savePref } from '../../src/ui/theme/theme'
import { darkTokens } from '../../src/ui/theme/tokens'

describe('tema', () => {
  it('parsePref aceita light/dark/system e cai para dark em qualquer outra coisa', () => {
    expect(parsePref('light')).toBe('light')
    expect(parsePref('system')).toBe('system')
    expect(parsePref('dark')).toBe('dark')
    expect(parsePref('azul')).toBe('dark')
    expect(parsePref(null)).toBe('dark')
    expect(parsePref(undefined)).toBe('dark')
  })

  it('resolveTheme: system segue o sistema, o resto é fixo', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('loadPref lê o valor salvo e cai para dark se o storage lança erro ou não existe', () => {
    expect(loadPref({ getItem: () => 'light' })).toBe('light')
    expect(loadPref({ getItem: () => { throw new Error('bloqueado') } })).toBe('dark')
    expect(loadPref(undefined)).toBe('dark')
  })

  it('savePref grava na chave theme e não lança se o storage falha', () => {
    const setItem = vi.fn()
    savePref('system', { setItem })
    expect(setItem).toHaveBeenCalledWith('theme', 'system')
    expect(() => savePref('light', { setItem: () => { throw new Error('bloqueado') } })).not.toThrow()
  })

  it('applyTheme define as variáveis, o data-theme e o color-scheme', () => {
    const style = { setProperty: vi.fn(), colorScheme: '' }
    const doc = { documentElement: { style, dataset: {} as Record<string, string> } } as unknown as Document
    applyTheme('dark', doc)
    expect(style.setProperty).toHaveBeenCalledWith('--bg', darkTokens.bg)
    expect(style.setProperty).toHaveBeenCalledWith('--text-secondary', darkTokens.textSecondary)
    expect(doc.documentElement.dataset.theme).toBe('dark')
    expect(style.colorScheme).toBe('dark')
  })
})
