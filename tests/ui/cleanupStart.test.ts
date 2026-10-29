import { describe, expect, it } from 'vitest'
import { startAnalysis } from '../../src/ui/cleanupStart'

describe('startAnalysis', () => {
  it('sem-uso roda a análise de inativos e duplicado roda a de duplicados', () => {
    expect(startAnalysis('sem-uso')).toBe('inactive')
    expect(startAnalysis('duplicado')).toBe('dups')
  })
  it('quebrado não roda nada sozinho: o teste de links precisa de um clique para pedir a permissão', () => {
    expect(startAnalysis('quebrado')).toBe('links-manual')
  })
  it('sem parâmetro, nenhuma análise', () => {
    expect(startAnalysis(undefined)).toBeNull()
  })
})
