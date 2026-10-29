import { useEffect, useMemo, useRef, useState } from 'react'
import type { FolderOption } from '../../core/folders'
import { searchPalette, type PaletteAction, type PaletteItem } from '../../core/palette'
import type { FlatLink } from '../../core/types'
import { domainOf } from '../format'

interface Props {
  links: FlatLink[]
  folders: FolderOption[]
  onClose: () => void
  onPickLink: (id: string, parentId: string) => void
  onMoveLink: (id: string) => void
  onPickFolder: (id: string) => void
  onAction: (action: PaletteAction) => void
}

const GROUP: Record<PaletteItem['kind'], string> = { link: 'Favoritos', folder: 'Pastas', action: 'Ações' }

/** Paleta de comandos (Ctrl K): achar favorito, ir para pasta, executar ação. */
export default function CommandPalette({ links, folders, onClose, onPickLink, onMoveLink, onPickFolder, onAction }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => opener?.focus?.() // devolve o foco a quem abriu o diálogo
  }, [])

  const results = useMemo(() => searchPalette(query, links, folders), [query, links, folders])
  const current = Math.min(active, Math.max(results.length - 1, 0))
  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links])

  const run = (item: PaletteItem | undefined, withModifier = false) => {
    if (!item) return
    if (item.kind === 'link') {
      const parentId = linkById.get(item.id)?.parentId ?? ''
      if (withModifier) onMoveLink(item.id)
      else onPickLink(item.id, parentId)
    } else if (item.kind === 'folder') onPickFolder(item.id)
    else onAction(item.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(current + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(current - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[current], e.ctrlKey || e.metaKey) }
    else if (e.key === 'Tab') {
      // O único campo que recebe Tab é a busca (os resultados usam as setas): o foco nunca sai do diálogo.
      e.preventDefault()
      input.current?.focus()
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div ref={dialog} className="dialog palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <input ref={input} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }} placeholder="Buscar favorito, pasta ou ação…" aria-label="Buscar" />
        <ul className="dialog-list" role="listbox" aria-label="Resultados">
          {results.map((item, i) => (
            <li key={`${item.kind}:${item.id}`} role="option" aria-selected={i === current}>
              {(i === 0 || results[i - 1]!.kind !== item.kind) && <div className="group-title">{GROUP[item.kind]}</div>}
              <button className={i === current ? 'active' : undefined} onClick={() => run(item)} tabIndex={-1}>
                {item.kind === 'link' && (
                  <>
                    <b>{item.title || domainOf(item.url)}</b> <span className="muted">{domainOf(item.url)}</span>
                    <span className="palette-meta">{item.path.join(' › ')}</span>
                  </>
                )}
                {item.kind === 'folder' && <>📁 {item.label || '(sem nome)'}</>}
                {item.kind === 'action' && item.label}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted dialog-empty">Nada encontrado.</li>}
        </ul>
        <div className="palette-hint">↑ ↓ navegar · Enter abre · Ctrl+Enter move o favorito · Esc fecha</div>
      </div>
    </div>
  )
}
