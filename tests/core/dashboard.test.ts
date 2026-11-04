import { describe, expect, it } from 'vitest'
import { TRASH_TITLE } from '../../src/core/cleanup'
import { computeDashboard, nextSteps, userFolderCount, type DashboardInput } from '../../src/core/dashboard'
import type { LinkCheckRecord } from '../../src/core/linkCheckRecord'
import type { BmFolder, BmLink, BmNode } from '../../src/core/types'

const DAY = 86_400_000
const NOW = 1000 * DAY
const lnk = (id: string, parentId: string, url: string, extra: Partial<BmLink> = {}): BmLink => ({
  kind: 'link', id, parentId, title: id, url, dateAdded: NOW - DAY, dateLastUsed: NOW - DAY, ...extra,
})
const dir = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })
const root = (barra: BmNode[], outros: BmNode[] = []): BmNode[] => [
  dir('0', '', '', [dir('1', '0', 'Barra', barra), dir('2', '0', 'Outros', outros), dir('3', '0', 'Móveis')]),
]
const input = (p: Partial<DashboardInput> = {}): DashboardInput => ({ now: NOW, inactiveDays: 365, keepPolicy: 'antiga', linkCheck: null, ...p })

describe('computeDashboard', () => {
  it('a revisar é a união sem repetir; sem categoria + em pastas = total', () => {
    const old = { dateLastUsed: NOW - 400 * DAY }
    const tree = root([
      dir('10', '1', 'Trabalho', [lnk('a', '10', 'https://a.example', old), lnk('b', '10', 'https://b.example')]),
      lnk('s', '1', 'https://a.example'), // solto, duplicado de "a"
    ])
    const d = computeDashboard(tree, input())
    expect(d.total).toBe(3)
    expect(d.inactive).toBe(1)
    expect(d.duplicates).toBe(1)
    // "a" é sem uso; a cópia a mais é "a" ou "s" conforme a política (ambos com o mesmo dateAdded: fica o mais fundo, "a")
    expect([...d.reviewIds].sort()).toEqual(['a', 's'])
    expect(d.review).toBe(2)
    expect(d.uncategorized).toBe(1)
    expect(d.inFolders).toBe(2)
    expect(d.uncategorized + d.inFolders).toBe(d.total)
    expect(d.organizedPct).toBe(66)
    expect(d.folderCount).toBe(1)
  })

  it('sem nenhum favorito: zeros, sem NaN', () => {
    const d = computeDashboard(root([]), input())
    expect(d.total).toBe(0)
    expect(d.organizedPct).toBe(0)
    expect(d.topFolders).toEqual([])
    expect(d.usage).toEqual({ thisMonth: 0, months1to3: 0, months3to12: 0, overYear: 0, noRecord: 0 })
    expect(Object.values(d).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false)
  })

  it('faixas de uso fixas, sem seguir o limiar', () => {
    const at = (id: string, days: number | null) => lnk(id, '1', `https://${id}.example`, { dateLastUsed: days === null ? undefined : NOW - days * DAY })
    const tree = root([at('d30', 30), at('d31', 31), at('d90', 90), at('d91', 91), at('d365', 365), at('d366', 366), at('nr', null)])
    const u = computeDashboard(tree, input({ inactiveDays: 30 })).usage
    expect(u).toEqual({ thisMonth: 1, months1to3: 2, months3to12: 2, overYear: 1, noRecord: 1 })
  })

  it('maiores pastas: primeiro nível, sem Lixeira, com Sem categoria, contagem > 0, no máximo 6', () => {
    const many = Array.from({ length: 7 }, (_, i) => dir(`f${i}`, '1', `P${i}`, Array.from({ length: i + 1 }, (_, j) => lnk(`f${i}-${j}`, `f${i}`, `https://f${i}-${j}.example`))))
    const tree = root(
      [...many, dir('vazia', '1', 'Vazia'), lnk('solto', '1', 'https://solto.example')],
      [dir('t', '2', TRASH_TITLE, Array.from({ length: 20 }, (_, j) => lnk(`t${j}`, 't', `https://t${j}.example`)))],
    )
    const top = computeDashboard(tree, input()).topFolders
    expect(top.map((t) => t.title)).toEqual(['P6', 'P5', 'P4', 'P3', 'P2', 'P1'])
    expect(top[0]).toEqual({ id: 'f6', title: 'P6', count: 7 })
  })

  it('maiores pastas: empate pela ordem da árvore; Sem categoria entra com id null', () => {
    const tree = root([dir('x', '1', 'X', [lnk('x1', 'x', 'https://x1.example')]), dir('y', '1', 'Y', [lnk('y1', 'y', 'https://y1.example')]), lnk('s', '1', 'https://s.example')])
    expect(computeDashboard(tree, input()).topFolders).toEqual([
      { id: 'x', title: 'X', count: 1 },
      { id: 'y', title: 'Y', count: 1 },
      { id: null, title: 'Sem categoria', count: 1 },
    ])
  })

  it('quebrados contam pelos favoritos de agora', () => {
    const rec: LinkCheckRecord = {
      checkedAt: NOW - DAY, complete: true,
      results: { 'https://q.example': 'quebrado', 'https://apagado.example': 'quebrado', 'https://i.example': 'incerto', 'https://ok.example': 'ok' },
    }
    const tree = root([
      dir('10', '1', 'A', [lnk('q1', '10', 'https://q.example/')]),
      dir('11', '1', 'B', [lnk('q2', '11', 'https://q.example')]),
      lnk('i', '1', 'https://i.example'), lnk('ok', '1', 'https://ok.example'),
    ])
    const d = computeDashboard(tree, input({ linkCheck: rec }))
    expect(d.broken).toBe(2)
    expect(d.reviewIds.has('q1') && d.reviewIds.has('q2')).toBe(true)
    expect(d.reviewIds.has('i')).toBe(false)
    expect(d.linkCheck).toEqual({ state: 'done', checkedAt: NOW - DAY })
  })

  it('estado do teste de links', () => {
    expect(computeDashboard(root([]), input()).linkCheck).toEqual({ state: 'never', checkedAt: null })
    expect(computeDashboard(root([]), input({ linkCheck: { checkedAt: 5, complete: false, results: {} } })).linkCheck).toEqual({ state: 'partial', checkedAt: 5 })
  })

  it('a Lixeira fica fora de tudo, menos de trash', () => {
    const tree = root([lnk('a', '1', 'https://a.example')], [dir('t', '2', TRASH_TITLE, [lnk('t1', 't', 'https://a.example', { dateLastUsed: 1 })])])
    const d = computeDashboard(tree, input())
    expect(d.total).toBe(1)
    expect(d.duplicates).toBe(0)
    expect(d.inactive).toBe(0)
    expect(d.trash).toBe(1)
    expect(d.folderCount).toBe(0)
  })

  it('limiar menor aumenta sem uso', () => {
    const tree = root([lnk('a', '1', 'https://a.example', { dateLastUsed: NOW - 60 * DAY })])
    expect(computeDashboard(tree, input({ inactiveDays: 365 })).inactive).toBe(0)
    expect(computeDashboard(tree, input({ inactiveDays: 30 })).inactive).toBe(1)
  })
})

describe('nextSteps', () => {
  const base = computeDashboard(root([]), input())
  const d = (p: Partial<typeof base>) => ({ ...base, ...p })
  const byId = (steps: ReturnType<typeof nextSteps>) => Object.fromEntries(steps.map((s) => [s.id, s]))
  const done = { state: 'done' as const, checkedAt: NOW - DAY }

  it('sempre os 6, na ordem fixa', () => {
    expect(nextSteps(base, null, NOW).map((s) => s.id)).toEqual(['duplicados', 'testar-links', 'quebrados', 'sem-uso', 'sem-categoria', 'backup'])
  })

  it('pendências seguem as contagens', () => {
    const s = byId(nextSteps(d({ duplicates: 3, broken: 2, inactive: 0, uncategorized: 5, linkCheck: done }), NOW, NOW))
    expect(s.duplicados).toEqual({ id: 'duplicados', count: 3, done: false })
    expect(s.quebrados).toEqual({ id: 'quebrados', count: 2, done: false })
    expect(s['sem-uso']).toEqual({ id: 'sem-uso', count: 0, done: true })
    expect(s['sem-categoria']).toEqual({ id: 'sem-categoria', count: 5, done: false })
    expect(s['testar-links']).toEqual({ id: 'testar-links', count: 0, done: true })
  })

  it('testar links: nunca, parcial ou mais de 30 dias fica pendente', () => {
    const t = (lc: typeof base.linkCheck) => byId(nextSteps(d({ linkCheck: lc }), null, NOW))['testar-links']!.done
    expect(t({ state: 'never', checkedAt: null })).toBe(false)
    expect(t({ state: 'partial', checkedAt: NOW })).toBe(false)
    expect(t({ state: 'done', checkedAt: NOW - 30 * DAY })).toBe(true)
    expect(t({ state: 'done', checkedAt: NOW - 30 * DAY - 1 })).toBe(false)
  })

  it('backup em dia até 7 dias', () => {
    const b = (at: number | null) => byId(nextSteps(base, at, NOW)).backup!.done
    expect(b(null)).toBe(false)
    expect(b(NOW - 7 * DAY)).toBe(true)
    expect(b(NOW - 7 * DAY - 1)).toBe(false)
  })
})

describe('userFolderCount', () => {
  it('conta as pastas fora das raízes do Chrome e fora da Lixeira, igual ao dashboard', () => {
    const tree = root([dir('10', '1', 'A', [dir('11', '10', 'B')])], [dir('t', '2', TRASH_TITLE, [dir('t2', 't', 'X')])])
    expect(userFolderCount(tree)).toBe(2)
    expect(computeDashboard(tree, input()).folderCount).toBe(2)
    expect(userFolderCount(root([]))).toBe(0)
  })
})
