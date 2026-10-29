import { useCallback, useEffect, useMemo, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { runPlan, BackupFailedError } from '../../core/plan'
import { planRestoreAll, planRestoreItem } from '../../core/restore'
import { snapshotToJson, snapshotToNetscapeHtml } from '../../core/snapshot'
import { flattenLinks, listFolders, searchLinks, summarize } from '../../core/tree'
import type { Plan, Snapshot } from '../../core/types'
import { listSnapshots } from '../../storage/snapshots'
import { makeBackup } from '../backupActions'
import { downloadText } from '../download'
import { backupFileName } from '../fileName'

const when = (t: number) => new Date(t).toLocaleString('pt-BR')

function describePlan(plan: Plan): string {
  const count = (op: string) => plan.operations.filter((o) => o.op === op).length
  return `${plan.label}: criar ${count('create-folder')} pasta(s) e ${count('create-link')} favorito(s), mover ${count('move')}.`
}

export default function BackupsView() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => listSnapshots().then(setSnapshots), [])
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
    }
  }

  const backupNow = () => run(async () => {
    const s = await makeBackup()
    return `Backup feito em ${when(s.createdAt)}.`
  })

  const restore = (plan: Plan) => run(async () => {
    if (plan.operations.length === 0) return 'Esse item já está no lugar original.'
    if (!window.confirm(`${describePlan(plan)}\n\nUm backup do estado atual será feito antes. Continuar?`)) return 'Restauração cancelada.'
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    return r.failed.length
      ? `Restaurado com ${r.failed.length} falha(s): ${r.failed.map((f) => f.error).join('; ')}`
      : `Restauração concluída (${r.applied} operações).`
  })

  const restoreAll = (s: Snapshot) => run(async () => {
    const plan = planRestoreAll(s, await chromeBookmarksApi.getTree(), new Date())
    if (!window.confirm(`${describePlan(plan)}\n\nNada existente será sobrescrito. Continuar?`)) return 'Restauração cancelada.'
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    return r.failed.length ? `Restaurado com ${r.failed.length} falha(s).` : 'Backup restaurado na pasta "Restaurado em ...".'
  })

  const restoreItem = (s: Snapshot, id: string) => run(async () => {
    const plan = planRestoreItem(s, id, await chromeBookmarksApi.getTree(), new Date())
    if (plan.operations.length === 0) return 'Esse item já está no lugar original.'
    if (!window.confirm(`${describePlan(plan)}\n\nUm backup do estado atual será feito antes. Continuar?`)) return 'Restauração cancelada.'
    const r = await runPlan(plan, chromeBookmarksApi, Date.now())
    return r.failed.length ? `Falhou: ${r.failed[0]?.error}` : 'Item restaurado.'
  })

  const opened = snapshots.find((s) => s.id === open)
  const links = useMemo(() => (opened ? flattenLinks(opened.tree) : []), [opened])
  const folders = useMemo(() => (opened ? listFolders(opened.tree) : []), [opened])
  const found = useMemo(() => searchLinks(links, query), [links, query])

  return (
    <div>
      <p>
        <button onClick={backupNow} disabled={busy}>Fazer backup agora</button>{' '}
        <small>Um backup também é feito automaticamente antes de cada limpeza ou restauração. Guardamos os últimos 20.</small>
      </p>
      {message && <p role="status">{message}</p>}
      {snapshots.length === 0 && <p>Nenhum backup ainda.</p>}
      <ul className="list">
        {snapshots.map((s) => (
          <li key={s.id}>
            <strong>{when(s.createdAt)}</strong> <span className="tag">{s.kind === 'manual' ? 'manual' : 'automático'}</span> {s.reason} — {summarize(s.tree).links} favoritos
            <div className="actions">
              <button onClick={() => downloadText(backupFileName(s.createdAt, 'json'), snapshotToJson(s), 'application/json')}>Exportar JSON</button>
              <button onClick={() => downloadText(backupFileName(s.createdAt, 'html'), snapshotToNetscapeHtml(s), 'text/html')}>Exportar HTML</button>
              <button onClick={() => restoreAll(s)} disabled={busy}>Restaurar tudo</button>
              <button onClick={() => { setOpen(open === s.id ? null : s.id); setQuery('') }}>
                {open === s.id ? 'Fechar' : 'Restaurar um item…'}
              </button>
            </div>
            {open === s.id && (
              <div className="detail">
                <label>
                  Buscar favorito neste backup{' '}
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="título ou endereço" />
                </label>
                <ul className="list">
                  {found.map((l) => (
                    <li key={l.id}>
                      {l.title || l.url} <small>{l.path.join(' / ')}</small>{' '}
                      <button onClick={() => restoreItem(s, l.id)} disabled={busy}>Restaurar</button>
                    </li>
                  ))}
                </ul>
                <details>
                  <summary>Restaurar uma pasta inteira ({folders.length} pastas)</summary>
                  <ul className="list">
                    {folders.map((f) => (
                      <li key={f.id}>
                        {[...f.path, f.title].join(' / ')}{' '}
                        <button onClick={() => restoreItem(s, f.id)} disabled={busy}>Restaurar</button>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
