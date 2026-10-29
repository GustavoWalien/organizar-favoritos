import { useEffect, useMemo, useRef, useState } from 'react'
import type { FolderOption } from '../../core/folders'
import { normalizeText } from '../../core/text'

interface Props {
  options: FolderOption[]
  count: number
  onPick: (folderId: string) => void
  onClose: () => void
}

/** Diálogo para escolher a pasta de destino, com busca. Funciona só com o teclado. */
export default function MovePicker({ options, count, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    input.current?.focus()
    return () => opener?.focus?.() // devolve o foco a quem abriu o diálogo
  }, [])

  const q = normalizeText(query)
  const results = useMemo(() => (q ? options.filter((o) => normalizeText(o.label).includes(q)) : options).slice(0, 50), [options, q])
  const current = Math.min(active, Math.max(results.length - 1, 0))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(current + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(current - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const pick = results[current]; if (pick) onPick(pick.id) }
    else if (e.key === 'Tab') {
      // O único campo que recebe Tab é a busca (os resultados usam as setas): o foco nunca sai do diálogo.
      e.preventDefault()
      input.current?.focus()
    }
  }

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-label="Mover para" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="dialog-head">Mover {count} {count === 1 ? 'favorito' : 'favoritos'} para…</div>
        <input ref={input} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0) }} placeholder="Buscar pasta…" aria-label="Buscar pasta" />
        <ul className="dialog-list" role="listbox" aria-label="Pastas">
          {results.map((o, i) => (
            <li key={o.id} role="option" aria-selected={i === current}>
              <button className={i === current ? 'active' : undefined} onClick={() => onPick(o.id)} tabIndex={-1}>📁 {o.label}</button>
            </li>
          ))}
          {results.length === 0 && <li className="muted dialog-empty">Nenhuma pasta encontrada.</li>}
        </ul>
      </div>
    </div>
  )
}
