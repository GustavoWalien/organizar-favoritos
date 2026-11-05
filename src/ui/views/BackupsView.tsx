import { useCallback, useEffect, useMemo, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { userFolderCount } from '../../core/dashboard'
import { findDeleted } from '../../core/deletedSearch'
import { runPlan, BackupFailedError } from '../../core/plan'
import { planRestoreAll, planRestoreItem, planRestoreReplace } from '../../core/restore'
import { snapshotToJson, snapshotToNetscapeHtml } from '../../core/snapshot'
import { summarize } from '../../core/tree'
import type { BmNode, Plan, Snapshot } from '../../core/types'
import { markExported } from '../../storage/prefs'
import { listSnapshots, MAX_SNAPSHOTS } from '../../storage/snapshots'
import { makeBackup } from '../backupActions'
import Icon from '../components/Icon'
import MoreMenu from '../components/MoreMenu'
import RestoreDialog from '../components/RestoreDialog'
import { downloadText } from '../download'
import { backupFileName } from '../fileName'
import { ageLabel } from '../format'

const when = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const EXPORT_STALE_MS = 30 * 86_400_000

function describePlan(plan: Plan): string {
  const count = (op: string) => plan.operations.filter((o) => o.op === op).length
  return `${plan.label}: criar ${count('create-folder')} pasta(s) e ${count('create-link')} favorito(s), mover ${count('move')}.`
}

interface Props {
  /** Árvore atual, para achar o que foi apagado. */
  tree: BmNode[]
  lastExportAt: number | null
  /** Depois de backup, exportação ou restauração: o painel relê os números. */
  onChanged: () => void
}

export default function BackupsView({ tree, lastExportAt, onChanged }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [restoring, setRestoring] = useState<Snapshot | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => listSnapshots().then((list) => setSnapshots([...list].sort((a, b) => b.createdAt - a.createdAt))), [])
  useEffect(() => { void reload() }, [reload])

  const run = async (fn: () => Promise<string>) => {
    setBusy(true)
    try {
      setMessage(await fn())
    } catch (e) {
      setMessage(e instanceof BackupFailedError ? e.message : `Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
      await reload()
      onChanged()
    }
  }

  const backupNow = () => run(async () => {
    const s = await makeBackup()
    return `Backup feito em ${when(s.createdAt)}.`
  })

  const exportAs = async (s: Snapshot, kind: 'json' | 'html') => {
    if (kind === 'json') downloadText(backupFileName(s.createdAt, 'json'), snapshotToJson(s), 'application/json')
    else downloadText(backupFileName(s.createdAt, 'html'), snapshotToNetscapeHtml(s), 'text/html')
    await markExported(Date.now())
    onChanged()
  }

  const restoreAll = (s: Snapshot) => run(async () => {
    const plan = planRestoreAll(s, await chromeBookmarksApi.getTree(), new Date())
    if (!window.confirm(`${describePlan(plan)}\n\nNada existente será sobrescrito. Continuar?`)) return 'Restauração cancelada.'
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    setRestoring(null)
    return r.failed.length ? `Restaurado com ${r.failed.length} falha(s).` : 'Backup restaurado na pasta "Restaurado em ...".'
  })

  const restoreReplace = (s: Snapshot) => run(async () => {
    const plan = planRestoreReplace(s, await chromeBookmarksApi.getTree(), new Date())
    const removed = plan.operations.filter((o) => o.op === 'remove').length
    const msg = `Trocar todos os seus favoritos pelos do backup de ${when(s.createdAt)}?\n\n`
      + `O que existe hoje (${removed} ${removed === 1 ? 'item' : 'itens'} na Barra, em Outros e em Celular) será apagado. A Lixeira fica como está.\n`
      + 'Um backup automático do estado atual é feito antes: para voltar atrás, restaure esse backup.'
    if (!window.confirm(msg)) return 'Restauração cancelada.'
    const at = Date.now()
    const r = await runPlan(plan, chromeBookmarksApi, at, undefined, { noUndo: true })
    setRestoring(null)
    const back = `Para voltar atrás, restaure o backup automático de ${when(at)}.`
    return r.failed.length ? `Restaurado com ${r.failed.length} falha(s). ${back}` : `Favoritos substituídos pelos do backup. ${back}`
  })

  const restoreItem = (s: Snapshot, id: string) => run(async () => {
    const plan = planRestoreItem(s, id, await chromeBookmarksApi.getTree(), new Date())
    if (plan.operations.length === 0) return 'Esse item já está no lugar original.'
    if (!window.confirm(`${describePlan(plan)}\n\nUm backup do estado atual será feito antes. Continuar?`)) return 'Restauração cancelada.'
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    return r.failed.length ? `Falhou: ${r.failed[0]?.error}` : 'Item restaurado.'
  })

  const now = Date.now()
  const latest = snapshots[0]
  const autos = snapshots.filter((s) => s.kind !== 'manual').length
  const manuals = snapshots.length - autos
  const exportStale = lastExportAt === null || now - lastExportAt > EXPORT_STALE_MS
  const deleted = useMemo(() => findDeleted(snapshots, tree, query), [snapshots, tree, query])
  const byId = useMemo(() => new Map(snapshots.map((s) => [s.id, s])), [snapshots])
  const sizes = useMemo(() => new Map(snapshots.map((s) => [s.id, { links: summarize(s.tree).links, folders: userFolderCount(s.tree) }])), [snapshots])

  return (
    <section className="backups">
      <div className="page-head">
        <div>
          <h1>Backups</h1>
          <p className="muted">Um backup é feito sozinho antes de cada mudança. Para restaurar, você escolhe substituir os favoritos de hoje pelos do backup (o estado atual vira um backup antes) ou restaurar lado a lado, numa pasta nova.</p>
        </div>
        <button className="primary big" onClick={backupNow} disabled={busy}><Icon name="archive" /> Fazer backup agora</button>
      </div>

      {message && <p role="status" className="status">{message}</p>}

      <div className="dash-row kpis">
        <section className="panel kpi-card">
          <span className="label-caps">Último backup</span>
          <span className={latest ? 'kpi tone-duplicados' : 'kpi muted'}>{latest ? ageLabel(latest.createdAt, now) : 'nenhum'}</span>
          <span className="muted small">{latest ? `${latest.kind === 'manual' ? 'manual' : 'automático'} · ${latest.reason}` : 'faça o primeiro agora'}</span>
        </section>
        <section className="panel kpi-card">
          <span className="label-caps">Guardados</span>
          <span className="kpi">{autos} + {manuals}</span>
          <span className="muted small">{autos} de {MAX_SNAPSHOTS} automáticos · {manuals} {manuals === 1 ? 'manual' : 'manuais'} (nunca apagados)</span>
        </section>
        <section className="panel kpi-card">
          <span className="label-caps">Cópia fora do navegador</span>
          <span className={exportStale ? 'kpi tone-sem-uso' : 'kpi tone-duplicados'}>{lastExportAt === null ? 'nunca' : ageLabel(lastExportAt, now)}</span>
          <span className="muted small">exporte em HTML para guardar no computador</span>
        </section>
      </div>

      <section className="panel history">
        <div className="panel-top">
          <h2>Histórico</h2>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Achar um favorito apagado…" aria-label="Achar um favorito apagado nos backups" />
        </div>

        {query.trim().length >= 2 && (
          <div className="deleted">
            {deleted.length === 0 ? <p className="muted small">Nenhum favorito apagado com esse nome ou endereço nos backups.</p> : (
              <ul className="activity">
                {deleted.map((h) => (
                  <li key={`${h.snapshotId}-${h.link.id}`}>
                    <div className="step-text"><div>{h.link.title || h.link.url}</div><div className="muted small">no backup de {when(h.createdAt)}</div></div>
                    <button onClick={() => { const s = byId.get(h.snapshotId); if (s) void restoreItem(s, h.link.id) }} disabled={busy}>Restaurar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {snapshots.length === 0 ? <p className="empty">Nenhum backup ainda.</p> : (
          <ul className="history-list">
            {snapshots.map((s) => {
              const size = sizes.get(s.id)!
              return (
                <li key={s.id} className="history-row">
                  <div><div>{ageLabel(s.createdAt, now)}</div><div className="muted small">{when(s.createdAt)}</div></div>
                  <div className="step-text"><div className="ellipsis">{s.reason}</div><div className="muted small">{size.links.toLocaleString('pt-BR')} favoritos · {size.folders.toLocaleString('pt-BR')} pastas</div></div>
                  <span className={s.kind === 'manual' ? 'tag tag-duplicado' : 'tag'}>{s.kind === 'manual' ? 'manual' : 'automático'}</span>
                  <button onClick={() => setRestoring(s)} disabled={busy}>Restaurar…</button>
                  <MoreMenu label="Mais ações deste backup" items={[
                    { label: 'Exportar HTML', onSelect: () => { void exportAs(s, 'html') } },
                    { label: 'Exportar JSON', onSelect: () => { void exportAs(s, 'json') } },
                  ]} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {restoring && (
        <RestoreDialog
          snapshot={restoring}
          title={when(restoring.createdAt)}
          busy={busy}
          onRestoreAll={() => { void restoreAll(restoring) }}
          onRestoreReplace={() => { void restoreReplace(restoring) }}
          onRestoreItem={(id) => { void restoreItem(restoring, id) }}
          onClose={() => setRestoring(null)}
        />
      )}
    </section>
  )
}
