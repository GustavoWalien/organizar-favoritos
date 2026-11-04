import { useCallback, useEffect, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { computeDashboard, nextSteps, type Dashboard, type NextStep } from '../../core/dashboard'
import { formatRoute, type View } from '../../core/route'
import { loadCleanupPrefs, loadLinkCheck } from '../../storage/prefs'
import { listSnapshots } from '../../storage/snapshots'
import { makeBackup } from '../backupActions'
import Icon from '../components/Icon'
import { ageLabel } from '../format'
import { stepText } from '../stepText'

const fmt = (n: number) => n.toLocaleString('pt-BR')

const STEP_VIEW: Record<Exclude<NextStep['id'], 'backup'>, View> = {
  duplicados: { name: 'cleanup', tab: 'duplicados' },
  'testar-links': { name: 'cleanup', tab: 'quebrados' },
  quebrados: { name: 'cleanup', tab: 'quebrados' },
  'sem-uso': { name: 'cleanup', tab: 'sem-uso' },
  'sem-categoria': { name: 'uncategorized' },
}

/** Abre o painel numa aba nova, já na tela pedida, e fecha o popup. */
function openPanel(view: View = { name: 'overview' }) {
  void browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') + formatRoute(view) })
  window.close()
}

/** Popup do ícone: um resumo do dashboard e atalhos para as telas. Nunca inicia o teste de links. */
export default function PopupView() {
  const [d, setD] = useState<Dashboard | null>(null)
  const [step, setStep] = useState<NextStep | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [tree, prefs, linkCheck, snaps] = await Promise.all([
      chromeBookmarksApi.getTree(), loadCleanupPrefs(), loadLinkCheck(), listSnapshots().catch(() => []),
    ])
    const now = Date.now()
    const dash = computeDashboard(tree, { now, inactiveDays: prefs.inactiveDays, keepPolicy: prefs.keepPolicy, linkCheck })
    const last = snaps.reduce<number | null>((m, s) => (m === null || s.createdAt > m ? s.createdAt : m), null)
    setD(dash)
    setLastBackupAt(last)
    setStep(nextSteps(dash, last, now).find((s) => !s.done) ?? null)
  }, [])
  useEffect(() => { load().catch((e) => setError(e instanceof Error ? e.message : String(e))) }, [load])

  const backup = async () => {
    setStatus('Fazendo backup…')
    try {
      await makeBackup()
      setStatus('Backup feito')
      await load()
    } catch (e) {
      setStatus(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  if (error) return <div className="popup"><p className="import-error">Não foi possível ler os favoritos: {error}</p></div>
  if (!d) return <div className="popup"><p className="muted">Lendo favoritos…</p></div>

  const now = Date.now()
  const runStep = (s: NextStep) => (s.id === 'backup' ? void backup() : openPanel(STEP_VIEW[s.id]))

  return (
    <div className="popup">
      <header className="popup-head">
        <span className="brand-mark"><Icon name="bookmark" /></span>
        <div>
          <div className="popup-title">Organizar Favoritos</div>
          <div className="muted small">{d.total === 0 ? 'Nenhum favorito ainda' : `${fmt(d.total)} ${d.total === 1 ? 'favorito' : 'favoritos'} · ${fmt(d.folderCount)} ${d.folderCount === 1 ? 'pasta' : 'pastas'}`}</div>
        </div>
      </header>

      <section className="panel popup-org">
        <div className="panel-top"><span className="label-caps">Organização</span><span className="popup-pct">{d.organizedPct}%</span></div>
        <div className="stack-bar small-bar" role="img" aria-label={`${fmt(d.inFolders)} em pastas, ${fmt(d.uncategorized)} sem categoria`}>
          {d.inFolders > 0 && <div className="seg-folders" style={{ flex: d.inFolders }} />}
          {d.uncategorized > 0 && <div className="seg-loose" style={{ flex: d.uncategorized }} />}
        </div>
        <div className="muted small">{fmt(d.inFolders)} em pastas · {fmt(d.uncategorized)} sem categoria</div>
      </section>

      <div className="popup-stats">
        <button className="popup-stat" onClick={() => openPanel({ name: 'cleanup', tab: 'sem-uso' })}><span className="tone-sem-uso">{fmt(d.inactive)}</span><small>sem uso</small></button>
        <button className="popup-stat" onClick={() => openPanel({ name: 'cleanup', tab: 'duplicados' })}><span className="tone-duplicados">{fmt(d.duplicates)}</span><small>duplicados</small></button>
        <button className="popup-stat" onClick={() => openPanel({ name: 'cleanup' })}><span className="tone-sem-uso">{fmt(d.review)}</span><small>a revisar</small></button>
      </div>

      <section className="popup-step">
        <span className="label-caps">Próximo passo</span>
        {step ? (
          <button className="popup-step-btn" onClick={() => runStep(step)}>
            <span className="step-text"><span className="block">{stepText(step).title}</span><small>{stepText(step).hint}</small></span>
            <Icon name="chevron-right" />
          </button>
        ) : <p className="muted small">Tudo em dia.</p>}
      </section>

      <div className="popup-backup muted small" role="status">
        {status ?? (lastBackupAt === null ? 'Nenhum backup ainda' : <><span className="tone-duplicados"><Icon name="check" size={14} /></span> Último backup {ageLabel(lastBackupAt, now)}</>)}
      </div>
      <div className="popup-actions">
        <button onClick={() => { void backup() }} disabled={status === 'Fazendo backup…'}>Fazer backup</button>
        <button className="primary" onClick={() => openPanel()}>Abrir painel</button>
      </div>
    </div>
  )
}
