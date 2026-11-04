import { describe, expect, it } from 'vitest'
import { recordLinkCheck, statusOf, type LinkCheckRecord } from '../../src/core/linkCheckRecord'
import type { LinkStatus } from '../../src/core/linkStatus'

const m = (entries: [string, LinkStatus][]) => new Map(entries)

describe('recordLinkCheck', () => {
  const prev: LinkCheckRecord = { checkedAt: 10, complete: true, results: { 'https://a.example': 'ok', 'https://old.example': 'quebrado' } }

  it('teste completo substitui tudo', () => {
    const r = recordLinkCheck(prev, m([['https://a.example/', 'quebrado']]), true, 99)
    expect(r).toEqual({ checkedAt: 99, complete: true, results: { 'https://a.example': 'quebrado' } })
  })

  it('cancelado com anterior: mescla, o novo vale mais', () => {
    const r = recordLinkCheck(prev, m([['https://a.example/', 'quebrado']]), false, 50)
    expect(r).toEqual({ checkedAt: 50, complete: false, results: { 'https://a.example': 'quebrado', 'https://old.example': 'quebrado' } })
  })

  it('cancelado no primeiro teste: só os novos, incompleto', () => {
    const r = recordLinkCheck(null, m([['https://b.example', 'incerto']]), false, 7)
    expect(r).toEqual({ checkedAt: 7, complete: false, results: { 'https://b.example': 'incerto' } })
  })

  it('chave normalizada; endereço não web fica de fora', () => {
    const r = recordLinkCheck(null, m([['HTTPS://A.example/?utm_source=x', 'ok'], ['javascript:x', 'quebrado']]), true, 1)
    expect(r.results).toEqual({ 'https://a.example': 'ok' })
  })

  it('statusOf acha pela forma normalizada', () => {
    expect(statusOf(prev, 'https://A.example/#topo')).toBe('ok')
    expect(statusOf(prev, 'https://nada.example')).toBeUndefined()
    expect(statusOf(null, 'https://a.example')).toBeUndefined()
  })
})
