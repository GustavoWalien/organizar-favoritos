import type { Dashboard, NextStep, StepId } from '../../core/dashboard'
import type { View } from '../../core/route'
import type { JournalEntry } from '../../core/types'
import Icon from '../components/Icon'
import { ageLabel } from '../format'
import { stepText } from '../stepText'

interface Props {
  dashboard: Dashboard
  steps: NextStep[]
  recent: JournalEntry[]
  lastBackupAt: number | null
  busy: boolean
  onNavigate: (view: View) => void
  onTestLinks: () => void
  onBackup: () => void
  onUndo: (planId: string) => void
}

const fmt = (n: number) => n.toLocaleString('pt-BR')
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`

const STEP_TARGET: Partial<Record<StepId, View>> = {
  duplicados: { name: 'cleanup', tab: 'duplicados' },
  quebrados: { name: 'cleanup', tab: 'quebrados' },
  'sem-uso': { name: 'cleanup', tab: 'sem-uso' },
  'sem-categoria': { name: 'ai' },
}

export default function OverviewView({ dashboard: d, steps, recent, lastBackupAt, busy, onNavigate, onTestLinks, onBackup, onUndo }: Props) {
  const now = Date.now()
  const pending = steps.filter((s) => !s.done)
  const shownSteps = [...pending, ...steps.filter((s) => s.done)].slice(0, 4)
  const runStep = (s: NextStep) => {
    if (s.id === 'testar-links') onTestLinks()
    else if (s.id === 'backup') onBackup()
    else onNavigate(STEP_TARGET[s.id]!)
  }

  const maxTop = Math.max(1, ...d.topFolders.map((f) => f.count))
  const usage = [
    { label: 'este mês', value: d.usage.thisMonth },
    { label: '1–3 meses', value: d.usage.months1to3 },
    { label: '3–12 meses', value: d.usage.months3to12 },
    { label: '+1 ano', value: d.usage.overYear, warn: true },
    { label: 'sem registro', value: d.usage.noRecord, muted: true },
  ]
  const maxUsage = Math.max(1, ...usage.map((u) => u.value))
  const last = recent[0]

  return (
    <section className="dashboard">
      <div className="page-head">
        <div>
          <h1>Seus favoritos</h1>
          <p className="muted">
            {d.total === 0 ? 'Nenhum favorito ainda' : `${plural(d.total, 'favorito', 'favoritos')} em ${plural(d.folderCount, 'pasta', 'pastas')}`}
            {' · '}{lastBackupAt === null ? 'nenhum backup ainda' : `último backup ${ageLabel(lastBackupAt, now)}`}
            {' · '}{last ? <>último plano: “{last.label}” <button className="link-button" onClick={() => onUndo(last.planId)} disabled={busy}>Desfazer</button></> : 'nada pendente para desfazer'}
          </p>
        </div>
        <button className="primary big" onClick={() => onNavigate({ name: 'ai' })}><Icon name="sparkle" /> Sugerir pastas com IA</button>
      </div>

      <div className="dash-row kpis">
        <section className="panel organization">
          <div className="panel-top"><h2 className="label-caps">Organização</h2><span className="muted small">meta: tudo em pastas, nada a revisar</span></div>
          <div className="big-number"><span className="kpi">{d.organizedPct}%</span><span className="muted">{d.total === 0 ? 'Nenhum favorito ainda' : 'dos favoritos já estão em pastas'}</span></div>
          <div className="stack-bar" role="img" aria-label={`${fmt(d.inFolders)} em pastas, ${fmt(d.uncategorized)} sem categoria`}>
            {d.inFolders > 0 && <div className="seg-folders" style={{ flex: d.inFolders }} />}
            {d.uncategorized > 0 && <div className="seg-loose" style={{ flex: d.uncategorized }} />}
          </div>
          <div className="legend">
            <span><i className="dot seg-folders" />Em pastas · {fmt(d.inFolders)}</span>
            <button className="link-button" onClick={() => onNavigate({ name: 'uncategorized' })}><i className="dot seg-loose" />Sem categoria · {fmt(d.uncategorized)}</button>
            {d.review > 0 && <button className="link-button warn-link" onClick={() => onNavigate({ name: 'cleanup' })}>{fmt(d.review)} a revisar →</button>}
          </div>
        </section>

        <button className="panel kpi-card" onClick={() => onNavigate({ name: 'cleanup', tab: 'sem-uso' })}>
          <span className="label-caps">Sem uso</span>
          <span className="kpi tone-sem-uso">{fmt(d.inactive)}</span>
          <span className="muted small">não abertos no período escolhido</span>
          <span className="go">Revisar →</span>
        </button>
        <button className="panel kpi-card" onClick={() => onNavigate({ name: 'cleanup', tab: 'duplicados' })}>
          <span className="label-caps">Duplicados</span>
          <span className="kpi tone-duplicados">{fmt(d.duplicates)}</span>
          <span className="muted small">cópias a mais do mesmo endereço</span>
          <span className="go">Revisar →</span>
        </button>
        <section className="panel kpi-card">
          <span className="label-caps">Links quebrados</span>
          {d.linkCheck.state === 'never' ? (
            <>
              <span className="kpi muted">—</span>
              <span className="muted small">nunca testados</span>
              <button className="go-button" onClick={onTestLinks} disabled={busy}>Testar agora</button>
            </>
          ) : (
            <>
              <span className="kpi tone-quebrados">{fmt(d.broken)}</span>
              <span className="muted small">{d.linkCheck.state === 'partial' ? 'teste incompleto' : 'testado'} {ageLabel(d.linkCheck.checkedAt ?? now, now)}</span>
              <button className="link-button go" onClick={() => onNavigate({ name: 'cleanup', tab: 'quebrados' })}>Revisar →</button>
            </>
          )}
        </section>
      </div>

      <div className="dash-row two">
        <section className="panel">
          <h2>Próximos passos</h2>
          <p className="muted small">Na ordem que mais limpa com menos esforço. Tudo pode ser desfeito.</p>
          <ol className="steps">
            {shownSteps.map((s, i) => {
              const t = stepText(s)
              return (
                <li key={s.id} className={s.done ? 'done' : undefined}>
                  <span className="step-num" aria-hidden="true">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
                  <div className="step-text"><div>{t.title}</div><div className="muted small">{t.hint}</div></div>
                  {!s.done && <button onClick={() => runStep(s)} disabled={busy}>{t.action}</button>}
                  {s.done && <span className="sr-only">feito</span>}
                </li>
              )
            })}
          </ol>
        </section>

        <section className="panel">
          <div className="panel-top"><h2>Maiores pastas</h2><span className="muted small">clique para abrir</span></div>
          {d.topFolders.length === 0 ? <p className="empty">Nenhuma pasta com favoritos ainda.</p> : (
            <ul className="bars">
              {d.topFolders.map((f) => (
                <li key={f.id ?? 'loose'}>
                  <button className="bar-row" onClick={() => onNavigate(f.id === null ? { name: 'uncategorized' } : { name: 'folder', id: f.id })}>
                    <span className="bar-name">{f.title || '(sem nome)'}</span>
                    <span className="bar-track"><span className={f.id === null ? 'bar-fill seg-loose' : 'bar-fill seg-folders'} style={{ width: `${(f.count / maxTop) * 100}%` }} /></span>
                    <span className="bar-count">{fmt(f.count)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash-row two">
        <section className="panel">
          <h2>Quando você usou cada favorito</h2>
          <p className="muted small">Pela data de último uso que o Chrome guarda.</p>
          <div className="columns" role="img" aria-label={usage.map((u) => `${u.label}: ${fmt(u.value)}`).join(', ')}>
            {usage.map((u) => (
              <div key={u.label} className="column">
                <span className={u.warn ? 'col-value tone-sem-uso' : 'col-value'}>{fmt(u.value)}</span>
                <div className={u.warn ? 'col-bar warn' : u.muted ? 'col-bar muted' : 'col-bar'} style={{ height: `${(u.value / maxUsage) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="columns-labels" aria-hidden="true">{usage.map((u) => <span key={u.label}>{u.label}</span>)}</div>
        </section>

        <section className="panel">
          <div className="panel-top"><h2>Atividade recente</h2><button className="link-button" onClick={() => onNavigate({ name: 'backups' })}>Ver backups</button></div>
          {recent.length === 0 ? <p className="empty">Nenhuma mudança feita pela extensão ainda.</p> : (
            <ul className="activity">
              {recent.map((e, i) => (
                <li key={e.planId}>
                  <div className="step-text"><div>{e.label}</div><div className="muted small">{ageLabel(e.appliedAt, now)}</div></div>
                  {i === 0 && <button className="link-button" onClick={() => onUndo(e.planId)} disabled={busy}>Desfazer</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
