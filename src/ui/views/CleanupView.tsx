import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { hasLinkCheckPermission, requestLinkCheckPermission } from '../../chrome/permissions'
import { findEmptyFolders, findTrash } from '../../core/cleanup'
import { findDuplicates, type DuplicateGroup, type KeepPolicy } from '../../core/duplicates'
import { findInactive } from '../../core/inactive'
import { recordLinkCheck, statusOf, type LinkCheckRecord } from '../../core/linkCheckRecord'
import { checkLinks, type LinkStatus } from '../../core/linkStatus'
import { BackupFailedError, runPlan } from '../../core/plan'
import type { CleanupTab } from '../../core/route'
import { flattenLinks } from '../../core/tree'
import type { BmNode, FlatLink } from '../../core/types'
import type { CleanupPrefs } from '../../storage/prefs'
import { prepareCleanup } from '../cleanupActions'
import { fromEmptyFolders, fromInactive, fromLinkStatuses } from '../candidates'
import ActionBar from '../components/ActionBar'
import DuplicateGroups from '../components/DuplicateGroups'
import LinkReviewList, { REASON_LABEL } from '../components/LinkReviewList'
import { applyKeep, groupKey, trashIds, type KeepOverrides } from '../duplicateChoice'
import { ageLabel } from '../format'
import { clear, filterByReason, selectAll, toggleOne, type Candidate, type Reason } from '../selection'

const PAGE = 200
const TABS: CleanupTab[] = ['sem-uso', 'duplicados', 'quebrados', 'pastas-vazias']
const THRESHOLDS = [{ days: 90, label: '3 meses' }, { days: 180, label: '6 meses' }, { days: 365, label: '12 meses' }, { days: 730, label: '24 meses' }]
const POLICIES: { value: KeepPolicy; label: string }[] = [
  { value: 'antiga', label: 'a mais antiga' },
  { value: 'especifica', label: 'a da pasta mais específica' },
  { value: 'usada', label: 'a mais usada recentemente' },
]

interface Props {
  tab?: CleanupTab
  prefs: CleanupPrefs
  linkCheck: LinkCheckRecord | null
  /** Muda a cada pedido de "Testar agora" vindo de fora (dashboard); a permissão já foi pedida no clique. */
  autoTestToken: number
  onTab: (tab: CleanupTab) => void
  onPrefs: (patch: Partial<CleanupPrefs>) => Promise<void>
  onLinkCheck: (rec: LinkCheckRecord) => Promise<void>
  /** Aviso com Desfazer do painel. */
  onNotify: (message: string, undoable?: boolean, planId?: string) => void
}

const linksOf = (t: BmNode[]): FlatLink[] => flattenLinks(t, findTrash(t)?.id)

function brokenCandidates(links: FlatLink[], rec: LinkCheckRecord | null): Candidate[] {
  const statuses = new Map<string, LinkStatus>()
  for (const l of links) {
    const s = statusOf(rec, l.url)
    if (s) statuses.set(l.url, s)
  }
  return fromLinkStatuses(links, statuses)
}

export default function CleanupView({ tab: routeTab, prefs, linkCheck, autoTestToken, onTab, onPrefs, onLinkCheck, onNotify }: Props) {
  const [tree, setTree] = useState<BmNode[] | null>(null)
  const [overrides, setOverrides] = useState<KeepOverrides>(new Map())
  const [included, setIncluded] = useState<Set<string> | null>(null)
  const [selected, setSelected] = useState<Set<string>>(clear())
  const [filter, setFilter] = useState<Reason | 'todos'>('todos')
  const [shown, setShown] = useState(PAGE)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController | null>(null)

  /** Lê a árvore de novo. Toda ação que altera favoritos parte daqui, não do estado antigo. */
  const reload = useCallback(async () => {
    const fresh = await chromeBookmarksApi.getTree()
    setTree(fresh)
    setOverrides(new Map())
    setIncluded(null)
    return fresh
  }, [])
  useEffect(() => { void reload() }, [reload])

  // As análises locais rodam sozinhas a cada leitura e a cada troca de preferência.
  const links = useMemo(() => (tree ? linksOf(tree) : []), [tree])
  const inactive = useMemo(() => fromInactive(findInactive(links, Date.now(), prefs.inactiveDays)), [links, prefs.inactiveDays])
  const baseGroups = useMemo(() => findDuplicates(links, prefs.keepPolicy), [links, prefs.keepPolicy])
  const groups: DuplicateGroup[] = useMemo(() => applyKeep(baseGroups, overrides), [baseGroups, overrides])
  const groupIncluded = useMemo(() => included ?? new Set(groups.map(groupKey)), [included, groups])
  const broken = useMemo(() => brokenCandidates(links, linkCheck), [links, linkCheck])
  const empties = useMemo(() => (tree ? fromEmptyFolders(findEmptyFolders(tree)) : []), [tree])

  const counts: Record<CleanupTab, number> = {
    'sem-uso': inactive.length,
    duplicados: groups.reduce((n, g) => n + g.extras.length, 0),
    quebrados: broken.filter((c) => c.reasons.includes('quebrado')).length,
    'pastas-vazias': empties.length,
  }
  const tab: CleanupTab = routeTab ?? TABS.find((t) => counts[t] > 0) ?? 'sem-uso'

  const switchTab = (t: CleanupTab) => {
    setSelected(clear())
    setFilter('todos')
    setShown(PAGE)
    onTab(t)
  }

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setMessage(e instanceof BackupFailedError ? e.message : `Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  /** `fromClick`: o pedido de permissão precisa vir direto do clique, antes de qualquer outra espera. */
  const testLinks = (fromClick: boolean) => guard(async () => {
    const ok = fromClick ? await requestLinkCheckPermission() : await hasLinkCheckPermission()
    if (!ok) {
      setMessage('Sem a permissão de acesso aos sites não dá para testar os links.')
      return
    }
    const fresh = linksOf(await reload())
    abort.current = new AbortController()
    const statuses = await checkLinks(fresh.map((l) => l.url), {
      signal: abort.current.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    })
    const aborted = abort.current.signal.aborted
    await onLinkCheck(recordLinkCheck(linkCheck, statuses, !aborted, Date.now()))
    setMessage(aborted ? `Teste cancelado: ${statuses.size} links verificados (resultado parcial guardado).` : `Teste concluído: ${statuses.size} links verificados.`)
  })

  // "Testar agora" vindo do dashboard: roda uma vez por pedido, quando a árvore já chegou.
  const lastToken = useRef(0)
  useEffect(() => {
    if (!tree || autoTestToken === 0 || autoTestToken === lastToken.current) return
    lastToken.current = autoTestToken
    void testLinks(false)
  }, [tree, autoTestToken])

  const toMove = tab === 'duplicados' ? trashIds(groups, groupIncluded) : [...selected]

  const apply = () => guard(async () => {
    const { plan, moves, blocked } = await prepareCleanup(chromeBookmarksApi, toMove, 'Limpeza de favoritos')
    if (blocked) { setMessage(blocked); return }
    if (moves === 0) { setMessage('Nada para mover: os itens marcados mudaram desde a análise.'); await reload(); return }
    if (!window.confirm(`Mover ${moves} ${moves === 1 ? 'item' : 'itens'} para a Lixeira?\n\nUm backup é feito antes e dá para desfazer.`)) return
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    const failedIds = new Set(r.failed.flatMap((f) => (f.op.op === 'move' ? [f.op.id] : [])))
    await reload()
    setSelected(new Set(failedIds))
    const moved = moves - failedIds.size
    setMessage(null)
    onNotify(
      r.failed.length
        ? `${moved} movido(s) para a Lixeira; ${r.failed.length} falharam (${[...new Set(r.failed.map((f) => f.error))].slice(0, 3).join('; ')})`
        : `${moved} ${moved === 1 ? 'item movido' : 'itens movidos'} para a Lixeira`,
      moved > 0,
      moved > 0 ? r.entry.planId : undefined,
    )
  })

  if (!tree) return <p className="loading">Lendo favoritos…</p>

  const list: Candidate[] = tab === 'sem-uso' ? inactive : tab === 'quebrados' ? broken : tab === 'pastas-vazias' ? empties : []
  const visible = filterByReason(list, filter)
  const dupKept = groups.filter((g) => groupIncluded.has(groupKey(g))).length

  const tabLabel: Record<CleanupTab, string> = {
    'sem-uso': `Sem uso há +${THRESHOLDS.find((t) => t.days === prefs.inactiveDays)?.label ?? `${prefs.inactiveDays} dias`}`,
    duplicados: 'Duplicados',
    quebrados: 'Links quebrados',
    'pastas-vazias': 'Pastas vazias',
  }
  const tabValue = (t: CleanupTab) => {
    if (t === 'quebrados' && !linkCheck) return <span className="tab-cta">Testar agora →</span>
    return <span className={`tab-value tone-${t}`}>{counts[t]}</span>
  }

  return (
    <div className="cleanup">
      <div className="page-head">
        <h1>Limpeza</h1>
        <p className="muted">A análise roda sozinha ao abrir. Nada é apagado: tudo vai para a Lixeira, com backup antes e Desfazer depois.</p>
      </div>

      <div className="tab-cards" role="tablist" aria-label="Tipo de problema">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab-card${tab === t ? ' active' : ''}`} onClick={() => switchTab(t)}>
            <span className="tab-label">{tabLabel[t]}</span>
            {tabValue(t)}
          </button>
        ))}
      </div>

      {message && <p role="status" className="status">{message}</p>}

      <div role="tabpanel" aria-label={tabLabel[tab]}>
        {tab === 'sem-uso' && (
          <div className="toolbar">
            <label>Sem uso há mais de{' '}
              <select value={prefs.inactiveDays} onChange={(e) => { void onPrefs({ inactiveDays: Number(e.target.value) }) }} disabled={busy}>
                {!THRESHOLDS.some((t) => t.days === prefs.inactiveDays) && <option value={prefs.inactiveDays}>{prefs.inactiveDays} dias</option>}
                {THRESHOLDS.map((t) => <option key={t.days} value={t.days}>{t.label}</option>)}
              </select>
            </label>
          </div>
        )}

        {tab === 'duplicados' && (
          <>
            <div className="toolbar">
              <label>Manter qual cópia{' '}
                <select value={prefs.keepPolicy} onChange={(e) => { setOverrides(new Map()); void onPrefs({ keepPolicy: e.target.value as KeepPolicy }) }} disabled={busy}>
                  {POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <span className="muted">{groups.length} {groups.length === 1 ? 'grupo' : 'grupos'}</span>
            </div>
            {groups.length === 0
              ? <p className="empty">Nenhum duplicado.</p>
              : (
                <DuplicateGroups
                  groups={groups}
                  included={groupIncluded}
                  onToggleGroup={(key) => setIncluded(() => { const next = new Set(groupIncluded); if (!next.delete(key)) next.add(key); return next })}
                  onKeep={(key, id) => setOverrides((o) => new Map(o).set(key, id))}
                />
              )}
          </>
        )}

        {tab === 'quebrados' && (
          <div className="toolbar">
            {progress ? (
              <>
                <progress value={progress.done} max={progress.total} /> {progress.done}/{progress.total}{' '}
                <button onClick={() => abort.current?.abort()}>Cancelar</button>
              </>
            ) : (
              <button className={linkCheck ? undefined : 'primary'} onClick={() => { void testLinks(true) }} disabled={busy}>{linkCheck ? 'Testar de novo' : 'Testar agora'}</button>
            )}
            {linkCheck && !progress && (
              <span className="muted">{linkCheck.complete ? 'testado' : 'teste incompleto'} {ageLabel(linkCheck.checkedAt, Date.now())}</span>
            )}
          </div>
        )}

        {tab !== 'duplicados' && (
          list.length === 0 ? (
            <p className="empty">
              {tab === 'quebrados' && !linkCheck ? 'Os links ainda não foram testados. O teste usa a rede e pede permissão ao Chrome uma vez.'
                : tab === 'sem-uso' ? 'Nenhum favorito sem uso nesse período.'
                : tab === 'quebrados' ? 'Nenhum link quebrado no último teste.'
                : 'Nenhuma pasta vazia.'}
            </p>
          ) : (
            <>
              <div className="toolbar">
                {tab === 'quebrados' && (
                  <label>Mostrar{' '}
                    <select value={filter} onChange={(e) => { setFilter(e.target.value as Reason | 'todos'); setShown(PAGE) }}>
                      <option value="todos">todos ({list.length})</option>
                      {(['quebrado', 'incerto'] as Reason[]).map((r) => {
                        const n = filterByReason(list, r).length
                        return n ? <option key={r} value={r}>{REASON_LABEL[r]} ({n})</option> : null
                      })}
                    </select>
                  </label>
                )}
                <button onClick={() => setSelected(selectAll(visible))}>Selecionar todos</button>
              </div>
              {tab === 'quebrados' && <p><small>"Selecionar todos" não marca os itens só "incertos": o site pode apenas estar bloqueando testes.</small></p>}
              <LinkReviewList items={visible.slice(0, shown)} selected={selected} onToggle={(id) => setSelected((s) => toggleOne(s, id))} />
              {visible.length > shown && <button className="more" onClick={() => setShown((n) => n + PAGE)}>Mostrar mais ({visible.length - shown} restantes)</button>}
            </>
          )
        )}
      </div>

      <ActionBar
        summary={tab === 'duplicados'
          ? <><b>{dupKept} {dupKept === 1 ? 'grupo escolhido' : 'grupos escolhidos'}</b> <span className="muted">· {toMove.length} vão para a Lixeira · {dupKept} ficam</span></>
          : <b>{toMove.length} {toMove.length === 1 ? 'escolhido' : 'escolhidos'}</b>}
        count={toMove.length}
        busy={busy}
        onClear={() => (tab === 'duplicados' ? setIncluded(new Set()) : setSelected(clear()))}
        onApply={() => { void apply() }}
      />
    </div>
  )
}
