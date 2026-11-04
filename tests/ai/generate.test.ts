import { describe, expect, it } from 'vitest'
import { generateProposal } from '../../src/ai/generate'
import { ProviderError, type Provider } from '../../src/ai/provider'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const lnk = (id: string, parentId: string, url = `https://${id}.example/`): BmLink => ({ kind: 'link', id, parentId, title: `T${id}`, url, dateAdded: 1 })
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const loose = (n: number) => Array.from({ length: n }, (_, i) => lnk(`l${i}`, '1'))
const tree = (extra: BmNode[] = []): BmNode[] => [
  dir('0', '', '', [
    dir('1', '0', 'Barra', [dir('10', '1', 'Dev', [lnk('g1', '10', 'https://github.com/a'), lnk('g2', '10', 'https://github.com/b')]), ...extra]),
    dir('2', '0', 'Outros', []),
  ]),
]

/** Provedor falso: `answer(prompt, n)` devolve o texto da n-ésima chamada. */
const fake = (answer: (user: string, n: number) => string | Error) => {
  const prompts: string[] = []
  const provider: Provider = {
    classify: async (_s, user) => {
      prompts.push(user)
      const a = answer(user, prompts.length)
      if (a instanceof Error) throw a
      return a
    },
    test: async () => {},
  }
  return { provider, prompts }
}
/** Responde todos os itens do lote para a candidata `pasta`, com `nova` e confiança dadas. */
const allTo = (user: string, pasta: number, nova = '', conf = 'alta') => {
  const items = JSON.parse(user.slice(user.lastIndexOf('['))) as { i: number }[]
  return JSON.stringify({ itens: items.map(({ i }) => ({ i, pasta, nova, confianca: conf, motivo: 'm' })) })
}
const base = { marks: new Map(), providerKind: 'anthropic' as const, model: 'claude-opus-5-5', now: 9 }
const sig = () => new AbortController().signal

describe('generateProposal', () => {
  it('regra de domínio resolve sem ir ao provedor', async () => {
    const { provider, prompts } = fake((u) => allTo(u, 1))
    const p = await generateProposal({ ...base, tree: tree([lnk('s', '1', 'https://github.com/c'), lnk('x', '1')]), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig() })
    const s = p.items.find((i) => i.itemId === 's')!
    expect(s).toMatchObject({ source: 'regra', confidence: 'alta', reason: 'regra: domínio já está aqui', folderId: '10', accepted: true })
    expect(prompts.join()).not.toContain('github.com')
    expect(p.items.find((i) => i.itemId === 'x')).toMatchObject({ source: 'ia', folderId: '10' })
  })

  it('resposta inválida: refaz uma vez; se falhar de novo, conta o lote e segue', async () => {
    const { provider, prompts } = fake((u, n) => (n <= 2 ? 'lixo' : allTo(u, 1)))
    const p = await generateProposal({ ...base, tree: tree(loose(150)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig() })
    expect(prompts).toHaveLength(3)
    expect(p.failedBatches).toBe(1)
    expect(p.items).toHaveLength(50)
    expect(p.missing).toBe(100)
  })

  it('pasta nova do lote 1 vira candidata no lote 2; baixa confiança vem desmarcada', async () => {
    const { provider, prompts } = fake((u, n) => (n === 1 ? allTo(u, 0, 'Finanças', 'baixa') : allTo(u, 1)))
    const p = await generateProposal({ ...base, tree: tree(loose(120)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig() })
    expect(prompts[1]).toContain('Barra › Finanças')
    const first = p.items.find((i) => i.itemId === 'l0')!
    expect(first).toMatchObject({ folderId: '1', newPath: ['Finanças'], accepted: false })
    expect(p.items.find((i) => i.itemId === 'l110')!.accepted).toBe(true)
  })

  it('cancelar depois do lote 1 devolve a proposta parcial', async () => {
    const ctrl = new AbortController()
    const { provider } = fake((u, n) => {
      if (n === 2) { ctrl.abort(); return new DOMException('aborted', 'AbortError') as unknown as Error }
      return allTo(u, 1)
    })
    const p = await generateProposal({ ...base, tree: tree(loose(150)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: ctrl.signal })
    expect(p.items).toHaveLength(100)
  })

  it('chave recusada interrompe e é relançada', async () => {
    const { provider } = fake(() => new ProviderError('auth', 'x'))
    await expect(generateProposal({ ...base, tree: tree(loose(3)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig() })).rejects.toMatchObject({ kind: 'auth' })
  })

  it('limite de uso no meio: devolve o que já veio e conta o resto como falha', async () => {
    const { provider } = fake((u, n) => (n === 1 ? allTo(u, 1) : new ProviderError('rate', 'x')))
    const p = await generateProposal({ ...base, tree: tree(loose(250)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig() })
    expect(p.items).toHaveLength(100)
    expect(p.failedBatches).toBe(2)
  })

  it('progresso e metadados', async () => {
    const seen: string[] = []
    const { provider } = fake((u) => allTo(u, 1))
    const p = await generateProposal({ ...base, tree: tree(loose(150)), scope: { kind: 'sem-categoria', allowNew: true }, provider, signal: sig(), onProgress: (x) => seen.push(`${x.batch}/${x.batches}`) })
    expect(seen).toEqual(['1/2', '2/2'])
    expect(p).toMatchObject({ createdAt: 9, provider: 'anthropic', model: 'claude-opus-5-5', failedBatches: 0, missing: 0 })
  })
})
