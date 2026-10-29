import { useState } from 'react'
import { hasMore, pageOf } from '../../core/paging'
import type { BmLink } from '../../core/types'
import { domainOf, lastUsedLabel } from '../format'
import type { ViewMode } from '../viewMode'

interface Props {
  links: BmLink[]
  mode: ViewMode
}

const titleOf = (l: BmLink) => l.title || domainOf(l.url) || '(sem título)'

/** Favoritos em lista, cards ou compacto, 200 de cada vez. Use `key` para voltar à primeira página ao trocar de pasta. */
export default function LinkList({ links, mode }: Props) {
  const [pages, setPages] = useState(1)
  const shown = pageOf(links, pages)
  const now = Date.now()

  if (links.length === 0) return <p className="empty">Nenhum favorito aqui.</p>

  return (
    <div>
      {mode === 'lista' && (
        <div className="rows" role="list">
          <div className="row row-head" aria-hidden="true">
            <span>Nome</span><span>Endereço</span><span>Último uso</span>
          </div>
          {shown.map((l) => (
            <div className="row" role="listitem" key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer" className="row-title">{titleOf(l)}</a>
              <span className="muted">{domainOf(l.url)}</span>
              <span className="muted">{lastUsedLabel(l.dateLastUsed, now)}</span>
            </div>
          ))}
        </div>
      )}
      {mode === 'cards' && (
        <ul className="cards">
          {shown.map((l) => (
            <li className="card" key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer" className="row-title">{titleOf(l)}</a>
              <span className="muted">{domainOf(l.url)}</span>
            </li>
          ))}
        </ul>
      )}
      {mode === 'compacto' && (
        <ul className="compact">
          {shown.map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer">{titleOf(l)}</a>
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
