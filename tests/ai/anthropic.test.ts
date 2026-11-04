import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { anthropicProvider } from '../../src/ai/anthropic'
import { errorMessage, ProviderError } from '../../src/ai/provider'

const cfg = { kind: 'anthropic' as const, apiKey: 'sk-ant-SEGREDO-1234', model: 'claude-opus-5-5' }
type Req = Record<string, unknown>
const fakeClient = (reply: (req: Req) => unknown) => {
  const calls: Req[] = []
  const client = { beta: { messages: { create: async (req: Req) => { calls.push(req); return reply(req) } } } }
  return { client: client as unknown as Pick<Anthropic, 'beta'>, calls }
}
const ok = (text: string, stop = 'end_turn') => ({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: stop })
const signal = new AbortController().signal

describe('anthropicProvider', () => {
  it('monta o pedido e devolve o texto', async () => {
    const { client, calls } = fakeClient(() => ok('{"itens":[]}'))
    const text = await anthropicProvider(cfg, client).classify('SIS', 'CTX', 'USR', signal)
    expect(text).toBe('{"itens":[]}')
    const req = calls[0]!
    expect(req).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 16000, fallbacks: 'default', betas: ['server-side-fallback-2026-07-01'] })
    expect(req.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } })
    expect(req.system).toEqual([{ type: 'text', text: 'SIS' }, { type: 'text', text: 'CTX', cache_control: { type: 'ephemeral' } }])
    expect(req.messages).toEqual([{ role: 'user', content: 'USR' }])
  })

  it('recusa e erros viram ProviderError com o tipo certo', async () => {
    const kindOf = async (reply: () => unknown) => {
      try {
        await anthropicProvider(cfg, fakeClient(reply).client).classify('s', 'c', 'u', signal)
        return 'nenhum'
      } catch (e) {
        return e instanceof ProviderError ? e.kind : 'outro'
      }
    }
    const h = new Headers()
    expect(await kindOf(() => ok('', 'refusal'))).toBe('refusal')
    expect(await kindOf(() => ok('{"itens":[', 'max_tokens'))).toBe('outro')
    expect(await kindOf(() => { throw new Anthropic.AuthenticationError(401, {}, 'bad key', h) })).toBe('auth')
    expect(await kindOf(() => { throw new Anthropic.RateLimitError(429, {}, 'slow', h) })).toBe('rate')
    expect(await kindOf(() => { throw new Anthropic.NotFoundError(404, {}, 'no model', h) })).toBe('model')
    expect(await kindOf(() => { throw Anthropic.APIError.generate(529, {}, 'overloaded', h) })).toBe('overloaded')
    expect(await kindOf(() => { throw new Anthropic.APIConnectionError({ message: 'net' }) })).toBe('network')
  })

  it('mensagem de erro nunca mostra a chave', () => {
    const msg = errorMessage(new ProviderError('auth', `falhou com ${cfg.apiKey}`), cfg)
    expect(msg).not.toContain('SEGREDO')
    expect(msg).toMatch(/chave foi recusada/)
    expect(errorMessage(new Error(`x ${cfg.apiKey}`), cfg)).not.toContain('SEGREDO')
  })
})
