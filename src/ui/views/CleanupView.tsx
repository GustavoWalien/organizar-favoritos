import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { requestLinkCheckPermission } from '../../chrome/permissions'
import { findEmptyFolders, findTrash } from '../../core/cleanup'
import { findDuplicates } from '../../core/duplicates'
import { findInactive } from '../../core/inactive'
import { checkLinks } from '../../core/linkStatus'
import { BackupFailedError, runPlan, undoLast } from '../../core/plan'
import { flattenLinks } from '../../core/tree'
import type { BmNode, JournalEntry } from '../../core/types'
import { lastEntry } from '../../storage/journal'
import { prepareCleanup, preparePurge } from '../cleanupActions'
import { fromDuplicates, fromEmptyFolders, fromInactive, fromLinkStatuses } from '../candidates'
import { startAnalysis, type CleanupStart } from '../cleanupStart'
import LinkReviewList, { REASON_LABEL } from '../components/LinkReviewList'
import { clear, filterByReason, mergeCandidates, selectAll, toggleOne, type Candidate, type Reason } from '../selection'

const PAGE = 200
type Parts = Record<'inactive' | 'dups' | 'links' | 'empties', Candidate[]>
const EMPTY: Parts = { inactive: [], dups: [], links: [], empties: [] }

export default function CleanupView({ start }: { start?: CleanupStart }) {
  const [tree, setTree] = useState<BmNode[] | null>(null)
  const [parts, setParts] = useState<Parts>(EMPTY)
  const [selected, setSelected] = useState<Set<string>>(clear())
  const [filter, setFilter] = useState<Reason | 'todos'>('todos')
  const [shown, setShown] = useState(PAGE)
  const [days, setDays] = useState(365)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastInfo, setLastInfo] = useState<Pick<JournalEntry, 'label' | 'appliedAt'> | null>(null)
  const abort = useRef<AbortController | null>(null)

  /** Lê a árvore e o último plano aplicado de novo. Toda ação que altera favoritos parte daqui, não do estado antigo. */
  const reload = useCallback(async () => {
    const fresh = await chromeBookmarksApi.getTree()
    setTree(fresh)
    const last = await lastEntry()
    setLastInfo(last ? { label: last.label, appliedAt: last.appliedAt } : null)
    return fresh
  }, [])
  useEffect(() => { void reload() }, [reload])

  // Vindo de um cartão da Visão geral: roda a análise correspondente uma única vez, assim que a árvore chega.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !tree) return
    started.current = true
    const which = startAnalysis(start)
    if (which === 'inactive') void analyzeInactive()
    else if (which === 'dups') void analyzeDuplicates()
  }, [tree, start])

  const candidates = useMemo(() => mergeCandidates(Object.values(parts).flat()), [parts])
  const visible = useMemo(() => filterByReason(candidates, filter), [candidates, filter])
  const setPart = (key: keyof Parts, list: Candidate[]) => { setParts((p) => ({ ...p, [key]: list })); setShown(PAGE) }
  const trash = tree ? findTrash(tree) : undefined

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

  const linksOf = (t: BmNode[]) => flattenLinks(t, findTrash(t)?.id)
  const analyzeInactive = () => guard(async () => {
    setPart('inactive', fromInactive(findInactive(linksOf(await reload()), Date.now(), days)))
  })
  const analyzeDuplicates = () => guard(async () => {
    setPart('dups', fromDuplicates(findDuplicates(linksOf(await reload()))))
  })
  const analyzeEmpties = () => guard(async () => {
    setPart('empties', fromEmptyFolders(findEmptyFolders(await reload())))
  })

  const testLinks = () => guard(async () => {
    // O pedido de permissão precisa vir direto do clique, antes de qualquer outra espera.
    if (!(await requestLinkCheckPermission())) {
      setMessage('Sem a permissão de acesso aos sites não dá para testar os links.')
      return
    }
    const links = linksOf(await reload())
    abort.current = new AbortController()
    const statuses = await checkLinks(links.map((l) => l.url), {
      signal: abort.current.signal,
      onProgress: (done, total) => setProgress({ done, total }),
    })
    setPart('links', fromLinkStatuses(links, statuses))
    setMessage(abort.current.signal.aborted ? `Teste cancelado: ${statuses.size} links verificados.` : `Teste concluído: ${statuses.size} links verificados.`)
  })

  const apply = () => guard(async () => {
    const { plan, moves, blocked } = await prepareCleanup(chromeBookmarksApi, [...selected], 'Limpeza de favoritos')
    if (blocked) { setMessage(blocked); return }
    if (moves === 0) { setMessage('Nada para mover: os itens marcados mudaram desde a análise. Analise de novo.'); return }
    if (!window.confirm(`Mover ${moves} item(ns) para a Lixeira?\n\nUm backup é feito antes e dá para desfazer.`)) return
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    const failedIds = new Set(r.failed.flatMap((f) => (f.op.op === 'move' ? [f.op.id] : [])))
    const gone = new Set([...selected].filter((id) => !failedIds.has(id)))
    setParts((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.filter((c) => !gone.has(c.id))])) as Parts)
    setSelected(new Set(failedIds))
    await reload()
    const moved = moves - failedIds.size
    setMessage(r.failed.length
      ? `${moved} movido(s); ${r.failed.length} falharam (${[...new Set(r.failed.map((f) => f.error))].slice(0, 3).join('; ')}).`
      : `${moved} item(ns) movido(s) para a Lixeira.`)
  })

  const undo = () => guard(async () => {
    if (!lastInfo) return
    const when = new Date(lastInfo.appliedAt).toLocaleString('pt-BR')
    if (!window.confirm(`Desfazer "${lastInfo.label}" (${when})?`)) return
    const r = await undoLast(chromeBookmarksApi)
    await reload()
    setMessage(r
      ? `Desfeito: ${r.undone} operação(ões)${r.relocated ? `, ${r.relocated} item(ns) foram para Outros favoritos porque a pasta de origem mudou` : ''}${r.skipped ? `, ${r.skipped} ignorada(s)` : ''}. Rode a análise de novo para atualizar a lista.`
      : 'Não há nada para desfazer.')
  })

  const purge = () => guard(async () => {
    const { plan, count } = await preparePurge(chromeBookmarksApi)
    if (plan.operations.length === 0) { setMessage('A Lixeira já está vazia.'); await reload(); return }
    if (!window.confirm(`Apagar DE VEZ ${count} favorito(s) da Lixeira?\n\nO botão Desfazer NÃO recupera isso. Só o último backup, na aba Backups.`)) return
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    await reload()
    setMessage(r.failed.length ? `Falhou: ${r.failed[0]?.error}` : 'Lixeira esvaziada.')
  })

  if (!tree) return <p>Lendo favoritos…</p>
  const nSelected = selected.size

  return (
    <div>
      <section className="toolbar">
        <label>Sem uso há mais de{' '}
          <input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} style={{ width: 70 }} /> dias
        </label>
        <button onClick={analyzeInactive} disabled={busy}>Analisar sem uso</button>
        <button onClick={analyzeDuplicates} disabled={busy}>Achar duplicados</button>
        <button onClick={analyzeEmpties} disabled={busy}>Achar pastas vazias</button>
        {progress ? (
          <>
            <progress value={progress.done} max={progress.total} /> {progress.done}/{progress.total}{' '}
            <button onClick={() => abort.current?.abort()}>Cancelar</button>
          </>
        ) : (
          <button className={start === 'quebrado' ? 'primary' : undefined} onClick={testLinks} disabled={busy}>Testar links</button>
        )}
      </section>

      {message && <p role="status" className="status">{message}</p>}
      {lastInfo && <p><button onClick={undo} disabled={busy}>Desfazer: {lastInfo.label} ({new Date(lastInfo.appliedAt).toLocaleString('pt-BR')})</button></p>}

      {candidates.length === 0 ? (
        <p>Rode uma análise para ver o que dá para limpar. Nada é alterado sem a sua confirmação.</p>
      ) : (
        <>
          <section className="toolbar">
            <label>Mostrar{' '}
              <select value={filter} onChange={(e) => { setFilter(e.target.value as Reason | 'todos'); setShown(PAGE) }}>
                <option value="todos">todos ({candidates.length})</option>
                {(Object.keys(REASON_LABEL) as Reason[]).map((r) => {
                  const n = filterByReason(candidates, r).length
                  return n ? <option key={r} value={r}>{REASON_LABEL[r]} ({n})</option> : null
                })}
              </select>
            </label>
            <button onClick={() => setSelected(selectAll(visible))}>Selecionar todos do filtro</button>
            <button onClick={() => setSelected(clear())}>Limpar seleção</button>
            <button onClick={apply} disabled={busy || nSelected === 0}>Mover {nSelected} para a Lixeira…</button>
          </section>
          <p><small>"Selecionar todos" não marca os itens só "incertos": o site pode apenas estar bloqueando testes.</small></p>
          <LinkReviewList items={visible.slice(0, shown)} selected={selected} onToggle={(id) => setSelected((s) => toggleOne(s, id))} />
          {visible.length > shown && <button onClick={() => setShown((n) => n + PAGE)}>Mostrar mais ({visible.length - shown} restantes)</button>}
        </>
      )}

      {trash && (
        <section className="trash">
          <h3>Lixeira</h3>
          <p>{flattenLinks([trash]).length} favorito(s) guardados. Revise no Chrome e esvazie quando tiver certeza.</p>
          <button onClick={purge} disabled={busy}>Esvaziar a Lixeira…</button>
        </section>
      )}
    </div>
  )
}
