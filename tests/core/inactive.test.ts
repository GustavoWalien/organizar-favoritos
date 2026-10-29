import { describe, expect, it } from 'vitest'
import { findInactive } from '../../src/core/inactive'
import type { FlatLink } from '../../src/core/types'

const DAY = 86_400_000
const NOW = 1_800_000_000_000
const link = (id: string, o: Partial<FlatLink> = {}): FlatLink => ({
  kind: 'link', id, parentId: 'p', title: id, url: `https://site${id}.com/`, dateAdded: NOW - 2000 * DAY, path: ['Barra'], ...o,
})

describe('findInactive', () => {
  it('usa dateLastUsed quando existe', () => {
    const recent = link('a', { dateLastUsed: NOW - 10 * DAY })
    const old = link('b', { dateLastUsed: NOW - 400 * DAY })
    const r = findInactive([recent, old], NOW)
    expect(r.map((f) => f.link.id)).toEqual(['b'])
    expect(r[0]).toMatchObject({ reason: 'sem-uso', lastTouch: NOW - 400 * DAY })
  })

  it('dateLastUsed = 0 ou ausente cai para dateAdded com motivo sem-registro', () => {
    const r = findInactive([link('a', { dateLastUsed: 0 }), link('b')], NOW)
    expect(r.map((f) => f.reason)).toEqual(['sem-registro', 'sem-registro'])
    expect(r[0]!.lastTouch).toBe(NOW - 2000 * DAY)
  })

  it('um favorito adicionado há 10 dias e nunca aberto não é sem uso', () => {
    expect(findInactive([link('a', { dateAdded: NOW - 10 * DAY })], NOW)).toEqual([])
  })

  it('respeita o limiar ajustável: 30 dias', () => {
    const l = link('a', { dateLastUsed: NOW - 45 * DAY })
    expect(findInactive([l], NOW, 30)).toHaveLength(1)
    expect(findInactive([l], NOW, 60)).toHaveLength(0)
  })

  it('o limite é exclusivo: exatamente 365 dias não entra', () => {
    expect(findInactive([link('a', { dateLastUsed: NOW - 365 * DAY })], NOW)).toEqual([])
    expect(findInactive([link('a', { dateLastUsed: NOW - 365 * DAY - 1 })], NOW)).toHaveLength(1)
  })

  it('ordena do mais antigo para o mais recente e ignora URLs que não são web', () => {
    const r = findInactive([
      link('novo', { dateLastUsed: NOW - 500 * DAY }),
      link('velho', { dateLastUsed: NOW - 900 * DAY }),
      link('bm', { url: 'javascript:void(0)', dateLastUsed: NOW - 999 * DAY }),
    ], NOW)
    expect(r.map((f) => f.link.id)).toEqual(['velho', 'novo'])
  })
})
