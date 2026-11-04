import { describe, expect, it } from 'vitest'
import { estimateCost, makeBatches, RESPONSE_SCHEMA, SYSTEM_PROMPT, userPrompt } from '../../src/ai/prompt'
import type { Candidate, ScopeItem } from '../../src/ai/scope'

const item = (n: number, title = `Título ${n}`): ScopeItem => ({ id: `chrome-${n}`, title, url: `https://site${n}.example/caminho/secreto?x=${n}`, domain: `site${n}.example`, fromFolderId: '1' })
const cands: Candidate[] = [
  { k: 0, folderId: '1', label: 'Barra', segments: ['Barra'], isRoot: true },
  { k: 1, folderId: '10', label: 'Barra › Dev', segments: ['Barra', 'Dev'], isRoot: false },
  { k: 2, folderId: '11', label: 'Barra › Dev › Tools', segments: ['Barra', 'Dev', 'Tools'], isRoot: false },
]

describe('makeBatches', () => {
  it('lotes de 100 com i local', () => {
    const b = makeBatches(Array.from({ length: 250 }, (_, n) => item(n)))
    expect(b.map((x) => x.items.length)).toEqual([100, 100, 50])
    expect(b[1]!.items[0]).toEqual({ i: 0, t: 'Título 100', d: 'site100.example' })
    expect(b[1]!.ids[0]).toBe('chrome-100')
  })
  it('corta títulos longos em 200', () => {
    expect(makeBatches([item(1, 'x'.repeat(300))])[0]!.items[0]!.t).toHaveLength(200)
  })
})

describe('userPrompt', () => {
  const batch = makeBatches([item(7)])[0]!
  it('candidatas numeradas, itens em JSON, sem URL nem id do Chrome', () => {
    const p = userPrompt(cands, batch, { kind: 'sem-categoria', allowNew: true })
    expect(p).toContain('0: Barra')
    expect(p).toContain('2: Barra › Dev › Tools')
    expect(p).toContain('"d":"site7.example"')
    expect(p).not.toContain('caminho/secreto')
    expect(p).not.toContain('chrome-7')
    expect(p).toMatch(/pode criar pastas novas/i)
  })
  it('sem pastas novas', () => {
    expect(userPrompt(cands, batch, { kind: 'sem-categoria', allowNew: false })).toMatch(/não crie pastas novas/i)
  })
  it('sistema e esquema existem', () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100)
    expect(JSON.stringify(RESPONSE_SCHEMA)).toContain('"confianca"')
  })
})

describe('estimateCost', () => {
  it('Anthropic com preço; outro modelo sem', () => {
    const c = estimateCost('claude-opus-5-5', 71, 80)
    expect(c.batches).toBe(1)
    expect(c.usdMax).toBeGreaterThan(0)
    expect(c.usdMax).toBeLessThan(1)
    expect(estimateCost('claude-haiku-5-5', 71, 80).usdMax!).toBeLessThan(c.usdMax!)
    expect(estimateCost('gpt-x', 10, 5)).toEqual({ batches: 1, usdMax: null })
    expect(estimateCost('claude-opus-5-5', 0, 5)).toEqual({ batches: 0, usdMax: 0 })
  })
})
