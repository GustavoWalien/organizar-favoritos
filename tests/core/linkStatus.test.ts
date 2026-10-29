import { describe, expect, it } from 'vitest'
import { checkLinks, classifyStatus } from '../../src/core/linkStatus'

type Handler = (url: string, method: string, signal?: AbortSignal | null) => Promise<Response> | Response
const fakeFetch = (h: Handler) =>
  ((url: string | URL | Request, init?: RequestInit) => Promise.resolve(h(String(url), init?.method ?? 'GET', init?.signal))) as typeof fetch
const res = (status: number) => new Response(null, { status })

describe('classifyStatus', () => {
  it('404 e 410 são quebrado', () => {
    expect(classifyStatus(404)).toBe('quebrado')
    expect(classifyStatus(410)).toBe('quebrado')
  })
  it('2xx e 3xx são ok', () => {
    for (const s of [200, 204, 301, 302, 399]) expect(classifyStatus(s), String(s)).toBe('ok')
  })
  it('o resto é incerto: 401, 403, 429, 5xx e fora do esperado', () => {
    for (const s of [400, 401, 403, 405, 429, 500, 503, 0]) expect(classifyStatus(s), String(s)).toBe('incerto')
  })
})

describe('checkLinks', () => {
  it('HEAD ok: não faz GET', async () => {
    const methods: string[] = []
    const r = await checkLinks(['https://a.com/'], { fetchFn: fakeFetch((_u, m) => { methods.push(m); return res(200) }) })
    expect(r.get('https://a.com/')).toBe('ok')
    expect(methods).toEqual(['HEAD'])
  })

  it('HEAD 404 mas GET 200: fica ok', async () => {
    const r = await checkLinks(['https://a.com/'], { fetchFn: fakeFetch((_u, m) => res(m === 'HEAD' ? 404 : 200)) })
    expect(r.get('https://a.com/')).toBe('ok')
  })

  it('HEAD 404 e GET 404: fica quebrado', async () => {
    const r = await checkLinks(['https://a.com/'], { fetchFn: fakeFetch(() => res(404)) })
    expect(r.get('https://a.com/')).toBe('quebrado')
  })

  it('erro de rede no HEAD tenta o GET', async () => {
    const r = await checkLinks(['https://a.com/'], {
      fetchFn: fakeFetch((_u, m) => { if (m === 'HEAD') throw new TypeError('reset'); return res(200) }),
    })
    expect(r.get('https://a.com/')).toBe('ok')
  })

  it('erro de rede nos dois e timeout viram incerto, nunca quebrado', async () => {
    const neverEnds = fakeFetch((_u, _m, signal) => new Promise<Response>((_ok, fail) => signal?.addEventListener('abort', () => fail(new DOMException('abort', 'AbortError')))))
    const r = await checkLinks(['https://a.com/', 'https://b.com/'], {
      timeoutMs: 20,
      fetchFn: (u, i) => (String(u).includes('a.com') ? Promise.reject(new TypeError('dns')) : neverEnds(u, i)),
    })
    expect(r.get('https://a.com/')).toBe('incerto')
    expect(r.get('https://b.com/')).toBe('incerto')
  })

  it('nunca passa de `concurrency` requisições ao mesmo tempo (500 URLs, limite 10)', async () => {
    let inFlight = 0
    let peak = 0
    const fetchFn = (async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return res(200)
    }) as typeof fetch
    const urls = Array.from({ length: 500 }, (_, i) => `https://site${i}.com/`)
    const r = await checkLinks(urls, { concurrency: 10, fetchFn })
    expect(r.size).toBe(500)
    expect(peak).toBeLessThanOrEqual(10)
    expect(peak).toBeGreaterThan(1)
  })

  it('URLs locais e não web não são buscadas nem aparecem no resultado', async () => {
    const called: string[] = []
    const r = await checkLinks(['http://localhost:3000/', 'http://192.168.0.2/', 'javascript:void(0)', 'chrome://settings', 'https://ok.com/'], {
      fetchFn: fakeFetch((u) => { called.push(u); return res(200) }),
    })
    expect([...r.keys()]).toEqual(['https://ok.com/'])
    expect(called).toEqual(['https://ok.com/'])
  })

  it('URL repetida é testada uma vez só', async () => {
    let calls = 0
    await checkLinks(['https://a.com/', 'https://a.com/'], { fetchFn: fakeFetch(() => { calls++; return res(200) }) })
    expect(calls).toBe(1)
  })

  it('abort interrompe e devolve só o que já foi concluído', async () => {
    const ctl = new AbortController()
    let n = 0
    const urls = Array.from({ length: 10 }, (_, i) => `https://s${i}.com/`)
    const r = await checkLinks(urls, {
      concurrency: 1,
      signal: ctl.signal,
      fetchFn: fakeFetch(() => { if (++n === 3) ctl.abort(); return res(200) }),
    })
    expect(r.size).toBe(2)
  })

  it('avisa o progresso até o total', async () => {
    const seen: number[] = []
    await checkLinks(['https://a.com/', 'https://b.com/', 'https://c.com/'], {
      concurrency: 1,
      fetchFn: fakeFetch(() => res(200)),
      onProgress: (done, total) => { expect(total).toBe(3); seen.push(done) },
    })
    expect(seen).toEqual([1, 2, 3])
  })
})
