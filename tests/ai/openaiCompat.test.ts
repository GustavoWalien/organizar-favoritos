import { describe, expect, it } from 'vitest'
import { openaiCompatProvider } from '../../src/ai/openaiCompat'
import { ProviderError, providerOrigin } from '../../src/ai/provider'

const cfg = { kind: 'openai-compat' as const, baseUrl: 'https://api.exemplo.com/v1/', apiKey: 'sk-XYZ', model: 'gpt-x' }
const signal = new AbortController().signal
type Call = { url: string; init: RequestInit }
const fakeFetch = (responses: (Response | Error)[]) => {
  const calls: Call[] = []
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses[Math.min(calls.length - 1, responses.length - 1)]!
    if (r instanceof Error) throw r
    return r
  }) as unknown as typeof fetch
  return { fn, calls }
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
const reply = (content: string) => json(200, { choices: [{ message: { content } }] })
const body = (c: Call) => JSON.parse(String(c.init.body))

describe('openaiCompatProvider', () => {
  it('POST em chat/completions com json_schema e a chave', async () => {
    const { fn, calls } = fakeFetch([reply('{"itens":[]}')])
    expect(await openaiCompatProvider(cfg, fn).classify('S', 'U', signal)).toBe('{"itens":[]}')
    expect(calls[0]!.url).toBe('https://api.exemplo.com/v1/chat/completions')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-XYZ')
    const b = body(calls[0]!)
    expect(b.model).toBe('gpt-x')
    expect(b.response_format.type).toBe('json_schema')
    expect(b.response_format.json_schema.strict).toBe(true)
    expect(b.messages).toEqual([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }])
  })

  it('sem chave não manda Authorization', async () => {
    const { fn, calls } = fakeFetch([reply('{}')])
    await openaiCompatProvider({ ...cfg, apiKey: '' }, fn).classify('S', 'U', signal)
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('400 no json_schema: tenta de novo com json_object', async () => {
    const { fn, calls } = fakeFetch([json(400, { error: { message: 'response_format not supported' } }), reply('{"itens":[]}')])
    expect(await openaiCompatProvider(cfg, fn).classify('S', 'U', signal)).toBe('{"itens":[]}')
    expect(calls).toHaveLength(2)
    expect(body(calls[1]!).response_format).toEqual({ type: 'json_object' })
  })

  it('erros por status e rede', async () => {
    const kindOf = async (rs: (Response | Error)[]) => {
      const { fn, calls } = fakeFetch(rs)
      try { await openaiCompatProvider(cfg, fn).classify('S', 'U', signal); return ['nenhum', calls.length] } catch (e) { return [e instanceof ProviderError ? e.kind : 'outro', calls.length] }
    }
    expect(await kindOf([json(401, {})])).toEqual(['auth', 1])
    expect(await kindOf([json(404, {})])).toEqual(['model', 1])
    expect(await kindOf([json(429, {}, { 'retry-after': '0' })])).toEqual(['rate', 3])
    expect(await kindOf([json(503, {}, { 'retry-after': '0' })])).toEqual(['overloaded', 3])
    expect(await kindOf([new TypeError('Failed to fetch')])).toEqual(['network', 1])
  })

  it('origem para a permissão', () => {
    expect(providerOrigin(cfg)).toBe('https://api.exemplo.com/*')
    expect(providerOrigin({ kind: 'anthropic', apiKey: '', model: 'm' })).toBe('https://api.anthropic.com/*')
  })
})
