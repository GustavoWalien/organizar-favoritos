import { useMemo } from 'react'
import type { Overview } from '../../core/overview'
import type { FolderOption } from '../../core/folders'
import { uncategorizedLinks } from '../../core/folders'
import type { View } from '../../core/route'
import type { BmNode } from '../../core/types'
import SelectableList from '../components/SelectableList'
import type { ViewMode } from '../viewMode'

interface Props {
  tree: BmNode[]
  overview: Overview
  mode: ViewMode
  folderOptions: FolderOption[]
  busy: boolean
  onNavigate: (view: View) => void
  onMove: (ids: string[], folderId: string) => void | Promise<void>
  onTrash: (ids: string[]) => void | Promise<void>
}

function Tile({ value, label, tone, onClick }: { value: string; label: string; tone?: 'warn' | 'danger' | 'ok'; onClick?: () => void }) {
  const body = (
    <>
      <span className="tile-value">{value}</span>
      <span className="tile-label">{label}</span>
    </>
  )
  return onClick ? (
    <button className={`tile ${tone ?? ''}`} onClick={onClick}>{body}</button>
  ) : (
    <div className={`tile ${tone ?? ''}`}>{body}</div>
  )
}

export default function OverviewView({ tree, overview, mode, folderOptions, busy, onNavigate, onMove, onTrash }: Props) {
  const loose = useMemo(() => uncategorizedLinks(tree), [tree])

  return (
    <section>
      <h2 className="view-title">Resumo dos seus favoritos</h2>
      <div className="tiles">
        <Tile value={String(overview.total)} label="favoritos" />
        <Tile value={String(overview.inactive)} label="sem uso há 1 ano →" tone="warn" onClick={() => onNavigate({ name: 'cleanup', tab: 'sem-uso' })} />
        <Tile value="?" label="quebrados · testar links →" tone="danger" onClick={() => onNavigate({ name: 'cleanup', tab: 'quebrados' })} />
        <Tile value={String(overview.duplicates)} label="duplicados →" tone="ok" onClick={() => onNavigate({ name: 'cleanup', tab: 'duplicados' })} />
      </div>

      <div className="view-head">
        <h2>❓ Sem categoria <small>{overview.uncategorized} {overview.uncategorized === 1 ? 'favorito' : 'favoritos'}</small></h2>
        <button onClick={() => onNavigate({ name: 'uncategorized' })}>Ver todos</button>
      </div>
      <p className="muted">Arraste pela alça ⋮⋮ até uma pasta da barra lateral, ou selecione e use “Mover para…”.</p>
      <SelectableList links={loose} mode={mode} folderOptions={folderOptions} busy={busy} onMove={onMove} onTrash={onTrash} />
    </section>
  )
}
