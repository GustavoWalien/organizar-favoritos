import { useState, type DragEvent } from 'react'
import { hasMore, pageOf } from '../../core/paging'
import type { BmLink } from '../../core/types'
import { domainOf, lastUsedLabel } from '../format'
import type { ViewMode } from '../viewMode'

interface Props {
  links: BmLink[]
  mode: ViewMode
  /** Com `onToggle`, cada item ganha caixa de seleção; com `onDragStart`, também a alça de arrastar. */
  selected?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: (ids: string[]) => void
  onDragStart?: (id: string, e: DragEvent) => void
}

const titleOf = (l: BmLink) => l.title || domainOf(l.url) || '(sem título)'

/** Favoritos em lista, cards ou compacto, 200 de cada vez. Use `key` para voltar à primeira página ao trocar de pasta. */
export default function LinkList({ links, mode, selected, onToggle, onToggleAll, onDragStart }: Props) {
  const [pages, setPages] = useState(1)
  const shown = pageOf(links, pages)
  const now = Date.now()
  const selectable = Boolean(onToggle)
  const isSel = (id: string) => selected?.has(id) ?? false
  const allShownSelected = shown.length > 0 && shown.every((l) => isSel(l.id))

  if (links.length === 0) return <p className="empty">Nenhum favorito aqui.</p>

  const controls = (l: BmLink) =>
    selectable && (
      <>
        <span className="handle" aria-hidden="true" title="Arraste para uma pasta">⋮⋮</span>
        <input type="checkbox" checked={isSel(l.id)} onChange={() => onToggle?.(l.id)} aria-label={`Selecionar ${titleOf(l)}`} />
      </>
    )
  const drag = (l: BmLink) => ({
    draggable: Boolean(onDragStart),
    onDragStart: (e: DragEvent) => onDragStart?.(l.id, e),
  })

  return (
    <div>
      {mode === 'lista' && (
        <div className={`rows${selectable ? ' selectable' : ''}`} role="list">
          <div className="row row-head">
            {selectable && (
              <>
                <span aria-hidden="true" />
                <input type="checkbox" checked={allShownSelected} onChange={() => onToggleAll?.(shown.map((l) => l.id))} aria-label="Selecionar todos os itens visíveis" />
              </>
            )}
            <span>Nome</span><span>Endereço</span><span>Último uso</span>
          </div>
          {shown.map((l) => (
            <div className={`row${isSel(l.id) ? ' selected' : ''}`} role="listitem" key={l.id} {...drag(l)}>
              {controls(l)}
              <a href={l.url} target="_blank" rel="noreferrer" className="row-title" draggable={false}>{titleOf(l)}</a>
              <span className="muted">{domainOf(l.url)}</span>
              <span className="muted">{lastUsedLabel(l.dateLastUsed, now)}</span>
            </div>
          ))}
        </div>
      )}
      {mode === 'cards' && (
        <ul className="cards">
          {shown.map((l) => (
            <li className={`card${isSel(l.id) ? ' selected' : ''}`} key={l.id} {...drag(l)}>
              {selectable && <div className="card-controls">{controls(l)}</div>}
              <a href={l.url} target="_blank" rel="noreferrer" className="row-title" draggable={false}>{titleOf(l)}</a>
              <span className="muted">{domainOf(l.url)}</span>
            </li>
          ))}
        </ul>
      )}
      {mode === 'compacto' && (
        <ul className="compact">
          {shown.map((l) => (
            <li className={isSel(l.id) ? 'selected' : undefined} key={l.id} {...drag(l)}>
              {controls(l)}
              <a href={l.url} target="_blank" rel="noreferrer" draggable={false}>{titleOf(l)}</a>
              <span className="muted"> · {domainOf(l.url)}</span>
            </li>
          ))}
        </ul>
      )}
      {hasMore(links, pages) && (
        <p><button onClick={() => setPages((p) => p + 1)}>Mostrar mais ({links.length - shown.length} restantes)</button></p>
      )}
    </div>
  )
}
