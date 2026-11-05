import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from '../../src/chrome/localStore'
import { clearProposal, clearProvider, loadProposal, loadProvider, maskKey, saveProposal, saveProvider, type Proposal } from '../../src/storage/aiStore'

const mem = (init: Record<string, unknown> = {}): KeyValueStore => {
  const d = new Map(Object.entries(init))
  return { get: async (k) => d.get(k), set: async (k, v) => { d.set(k, v) } }
}
const proposal: Proposal = {
  createdAt: 5, provider: 'anthropic', model: 'claude-opus-5-5', scope: { kind: 'sem-categoria', allowNew: true },
  items: [{ itemId: 'a', folderId: '10', newPath: ['X'], confidence: 'media', reason: 'r', title: 'A', domain: 'a.com', fromFolderId: '1', source: 'ia', accepted: true }],
  failedBatches: 0, missing: 2,
}

describe('aiStore', () => {
  it('ida e volta', async () => {
    const s = mem()
    expect(await loadProvider(s)).toBeNull()
    expect(await loadProposal(s)).toBeNull()
    await saveProvider({ kind: 'anthropic', apiKey: 'sk-ant-1234', model: 'claude-opus-5-5' }, s)
    expect(await loadProvider(s)).toEqual({ kind: 'anthropic', apiKey: 'sk-ant-1234', model: 'claude-opus-5-5' })
    await saveProvider({ kind: 'openai-compat', baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-x' }, s)
    expect((await loadProvider(s))?.kind).toBe('openai-compat')
    await saveProposal(proposal, s)
    expect(await loadProposal(s)).toEqual(proposal)
    await clearProposal(s)
    expect(await loadProposal(s)).toBeNull()
  })

  it('clearProvider apaga a chave do armazenamento', async () => {
    const d = new Map<string, unknown>()
    const s: KeyValueStore = { get: async (k) => d.get(k), set: async (k, v) => { d.set(k, v) } }
    await saveProvider({ kind: 'anthropic', apiKey: 'sk-ant-SEGREDO', model: 'claude-haiku-5-5' }, s)
    await clearProvider(s)
    expect(await loadProvider(s)).toBeNull()
    expect(JSON.stringify([...d])).not.toContain('SEGREDO')
  })

  it('dados inválidos viram null', async () => {
    for (const bad of [{ kind: 'x', model: 'm' }, { kind: 'anthropic', apiKey: 'k' }, { kind: 'openai-compat', baseUrl: 'ftp://x', apiKey: '', model: 'm' }, 'lixo']) {
      expect(await loadProvider(mem({ aiProvider: bad })), JSON.stringify(bad)).toBeNull()
    }
    const noFolder = { ...proposal, items: [{ ...proposal.items[0], folderId: undefined }] }
    const badConf = { ...proposal, items: [{ ...proposal.items[0], confidence: 'talvez' }] }
    for (const bad of [{ ...proposal, items: undefined }, noFolder, badConf, 42]) {
      expect(await loadProposal(mem({ aiProposal: bad }))).toBeNull()
    }
    const broken: KeyValueStore = { get: async () => { throw new Error('x') }, set: async () => {} }
    expect(await loadProvider(broken)).toBeNull()
    expect(await loadProposal(broken)).toBeNull()
  })

  it('maskKey', () => {
    expect(maskKey('')).toBe('')
    expect(maskKey('sk-ant-abcd1234')).toBe('…1234')
    expect(maskKey('abc')).toBe('…')
  })
})
