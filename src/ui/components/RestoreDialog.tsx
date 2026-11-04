import { useEffect, useMemo, useRef, useState } from 'react'
import { flattenLinks, listFolders, searchLinks } from '../../core/tree'
import type { Snapshot } from '../../core/types'

interface Props {
  snapshot: Snapshot
  title: string
  busy: boolean
  onRestoreAll: () => void
  onRestoreItem: (id: string) => void
  onClose: () => void
}

/** "Restaurar…": restaurar tudo (pasta nova) ou um favorito ou pasta do backup. */
export default function RestoreDialog({ snapshot, title, busy, onRestoreAll, onRestoreItem, onClose }: Props) {
  const [query, setQuery] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  const links = useMemo(() => flattenLinks(snapshot.tree), [snapshot])
  const folders = useMemo(() => listFolders(snapshot.tree), [snapshot])
  const found = useMemo(() => searchLinks(links, query), [links, query])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => opener?.focus?.()
  }, [])

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div
        ref={dialog}
        className="dialog restore-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Restaurar o backup de ${title}`}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
      >
        <h2 className="dialog-head">Restaurar o backup de {title}</h2>
        <section className="restore-option">
          <div>
            <strong>Restaurar tudo</strong>
            <p className="muted small">Cria a pasta "Restaurado em &lt;data&gt;" com a árvore inteira. Nada do que existe hoje é mexido.</p>
          </div>
          <button className="primary" onClick={onRestoreAll} disabled={busy}>Restaurar tudo</button>
        </section>
        <section className="restore-option column">
          <strong>Restaurar um item</strong>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar favorito por título ou endereço" aria-label="Buscar favorito neste backup" />
          <ul className="dialog-list">
            {found.map((l) => (
              <li key={l.id} className="restore-hit">
                <span className="step-text"><span>{l.title || l.url}</span> <small>{l.path.join(' / ')}</small></span>
                <button onClick={() => onRestoreItem(l.id)} disabled={busy}>Restaurar</button>
              </li>
            ))}
          </ul>
          <details>
            <summary>Restaurar uma pasta inteira ({folders.length} pastas)</summary>
            <ul className="dialog-list">
              {folders.map((f) => (
                <li key={f.id} className="restore-hit">
                  <span className="step-text">{[...f.path, f.title].join(' / ')}</span>
                  <button onClick={() => onRestoreItem(f.id)} disabled={busy}>Restaurar</button>
                </li>
              ))}
            </ul>
          </details>
        </section>
        <div className="dialog-actions"><button onClick={onClose}>Fechar</button></div>
      </div>
    </div>
  )
}
