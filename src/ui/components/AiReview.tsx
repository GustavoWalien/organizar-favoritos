import { useEffect, useMemo, useRef, useState } from 'react'
import { groupByTarget, newFolderKey, planFromProposal, type TargetGroup } from '../../ai/applyPlan'
import { buildScope } from '../../ai/scope'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import type { FolderOption } from '../../core/folders'
import { runPlan } from '../../core/plan'
import type { MarksMap } from '../../core/marks'
import type { BmNode } from '../../core/types'
import { marksStore } from '../../storage/flags'
import type { Proposal } from '../../storage/aiStore'
import type { AiSuggestionsState } from '../state/useAiSuggestions'
import { ageLabel } from '../format'
import Icon from './Icon'
import MovePicker from './MovePicker'

const CONF_LABEL = { alta: 'alta', media: 'média', baixa: 'baixa' } as const
const fmt = (n: number) => n.toLocaleString('pt-BR')

interface Props {
  tree: BmNode[]
  marks: MarksMap
  proposal: Proposal
  ai: AiSuggestionsState
  onNotify: (message: string, undoable?: boolean, planId?: string) => void
}

function GroupCheck({ g, onChange }: { g: TargetGroup; onChange: (v: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const on = g.items.filter((i) => i.accepted).length
  useEffect(() => { if (ref.current) ref.current.indeterminate = on > 0 && on < g.items.length }, [on, g.items.length])
  return <input ref={ref} type="checkbox" checked={on === g.items.length} onChange={(e) => onChange(e.target.checked)} aria-label={`Aceitar a pasta ${g.label}`} />
}

/** Tela 6 do quadro: proposta agrupada por destino, revisão item a item e Aplicar. */
export default function AiReview({ tree, marks, proposal: p, ai, onNotify }: Props) {
  const [onlyLow, setOnlyLow] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [moving, setMoving] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  // Item cujo destino é a pasta onde já está: não é mudança.
  const inPlace = (it: Proposal['items'][number]) => it.newPath.length === 0 && it.folderId === it.fromFolderId
  const changes = useMemo(() => ({ ...p, items: p.items.filter((it) => !inPlace(it)) }), [p])
  const stay = p.items.length - changes.items.length
  const groups = useMemo(() => groupByTarget(changes, tree), [changes, tree])
  const visible = onlyLow ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.confidence === 'baixa') })).filter((g) => g.items.length > 0) : groups

  const accepted = changes.items.filter((i) => i.accepted)
  const newFolderCount = new Set(accepted.filter((i) => i.newPath.length > 0).map((i) => newFolderKey(i.folderId, i.newPath))).size
  const refused = changes.items.length - accepted.length

  // Opções de "Mudar pasta": candidatas do escopo + pastas novas da proposta.
  const options: FolderOption[] = useMemo(() => {
    const sc = buildScope(tree, marks, p.scope)
    const existing = sc.candidates.filter((c) => !c.isRoot).map((c) => ({ id: c.folderId, label: c.label }))
    const news = groups.filter((g) => g.isNew).map((g) => ({ id: `nova:${g.key}`, label: `${g.label} (nova)` }))
    return [...existing, ...news]
  }, [tree, marks, p.scope, groups])
  const pick = (value: string) => {
    if (!moving) return
    if (value.startsWith('nova:')) {
      const g = groups.find((x) => `nova:${x.key}` === value)
      if (g) ai.retarget(moving, g.folderId, g.newPath)
    } else ai.retarget(moving, value, [])
    setMoving(null)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const fresh = await chromeBookmarksApi.getTree()
      const marks = new Map((await marksStore.all()).map((m) => [m.id, m]))
      const r = planFromProposal(p, fresh, marks, Date.now())
      if (r.moves === 0) { onNotify(r.changed > 0 ? `Nada para aplicar: ${r.changed} mudaram desde a sugestão` : 'Nada para aplicar'); return }
      const msg = `Mover ${r.moves} ${r.moves === 1 ? 'favorito' : 'favoritos'}${r.newFolders ? ` e criar ${r.newFolders} ${r.newFolders === 1 ? 'pasta' : 'pastas'}` : ''}?\n\nUm backup é feito antes e dá para desfazer.`
      if (!window.confirm(msg)) return
      const res = await runPlan(r.plan, chromeBookmarksApi, Date.now(), undefined, { shareBackup: false })
      const extra = [r.changed ? `${r.changed} mudaram desde a sugestão` : '', res.failed.length ? `${res.failed.length} falharam` : ''].filter(Boolean).join(' · ')
      onNotify(`Sugestões aplicadas: ${r.moves} ${r.moves === 1 ? 'favorito movido' : 'favoritos movidos'}${extra ? ` (${extra})` : ''}`, res.applied > 0, res.applied > 0 ? res.entry.planId : undefined)
      await ai.discard()
    } catch (e) {
      onNotify(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const discard = () => { if (window.confirm('Descartar a proposta? As sugestões serão apagadas e nada muda nos favoritos.')) void ai.discard() }
  const scopeLabel = p.scope.kind === 'sem-categoria' ? 'Sem categoria' : p.scope.kind === 'todos' ? 'Todos os favoritos' : 'Dentro de uma pasta'

  return (
    <section className="ai">
      <div className="page-head">
        <div>
          <h1>Revisar sugestões</h1>
          <p className="muted">{scopeLabel} · {fmt(p.items.length)} favoritos · {p.model} · gerado {ageLabel(p.createdAt, Date.now())}. A proposta fica guardada até você aplicar ou descartar.</p>
        </div>
        <div className="toolbar">
          <button aria-pressed={onlyLow} onClick={() => setOnlyLow((v) => !v)}>Só baixa confiança</button>
          <button onClick={() => setCollapsed((v) => !v)}>{collapsed ? 'Expandir pastas' : 'Recolher pastas'}</button>
        </div>
      </div>

      {(p.missing > 0 || p.failedBatches > 0) && (
        <p className="status">{fmt(p.missing)} {p.missing === 1 ? 'favorito ficou' : 'favoritos ficaram'} sem sugestão{p.failedBatches ? ` (${p.failedBatches} ${p.failedBatches === 1 ? 'lote com erro' : 'lotes com erro'})` : ''} e {p.missing === 1 ? 'fica' : 'ficam'} onde {p.missing === 1 ? 'está' : 'estão'}.</p>
      )}

      <div className="dup-groups">
        {visible.map((g) => (
          <section key={g.key} className="dup-group">
            <div className="dup-head">
              <GroupCheck g={g} onChange={(v) => ai.setAccepted(g.items.map((i) => i.itemId), v)} />
              <Icon name="folder" />
              <div className="dup-title"><strong>{g.label}</strong></div>
              <span className={g.isNew ? 'tag tag-nova' : 'tag'}>{g.isNew ? 'nova' : 'existente'}</span>
              <span className="muted small">{g.items.length}</span>
              {g.isNew && (
                <button className="link-button" onClick={() => {
                  const name = window.prompt('Novo nome da pasta', g.newPath.at(-1))
                  if (name) ai.rename(g.folderId, g.newPath, name)
                }}>Renomear</button>
              )}
            </div>
            {!collapsed && g.items.map((it) => (
              <div key={it.itemId} className="ai-row">
                <input type="checkbox" checked={it.accepted} onChange={(e) => ai.setAccepted([it.itemId], e.target.checked)} aria-label={`Aceitar ${it.title}`} />
                <span className="ellipsis" title={it.reason}>{it.title || '(sem título)'} <span className="muted">· {it.domain}</span></span>
                <span className="muted ellipsis">{it.reason}</span>
                <span className={`tag conf-${it.confidence}`}>{CONF_LABEL[it.confidence]}</span>
                <button className="link-button" onClick={() => setMoving([it.itemId])}>Mudar pasta</button>
              </div>
            ))}
          </section>
        ))}
        {stay > 0 && <p className="muted small">{fmt(stay)} {stay === 1 ? 'favorito já está' : 'favoritos já estão'} no lugar certo.</p>}
      </div>

      <div className="action-bar" role="region" aria-label="Aplicar sugestões">
        <div className="action-summary"><b>{fmt(accepted.length)} de {fmt(changes.items.length)} aceitos</b> <span className="muted">· {newFolderCount} {newFolderCount === 1 ? 'pasta nova' : 'pastas novas'} · {fmt(refused)} recusados ficam onde estão</span></div>
        <button onClick={discard} disabled={busy}>Descartar proposta</button>
        <button className="primary" onClick={() => { void apply() }} disabled={busy || accepted.length === 0}>{busy ? 'Aplicando…' : `Aplicar ${fmt(accepted.length)}`}</button>
      </div>

      {moving && <MovePicker options={options} count={moving.length} onPick={pick} onClose={() => setMoving(null)} />}
    </section>
  )
}
