import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'

interface Props {
  label: string
  items: { label: string; onSelect: () => void }[]
}

/** Botão ⋯ com um menu pequeno. Fecha com Esc, com clique fora e ao escolher um item. */
export default function MoreMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    box.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    const opts = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = opts.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); box.current?.querySelector<HTMLButtonElement>('.more-trigger')?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length]?.focus() }
  }

  return (
    <div className="more-menu" ref={box} onKeyDown={onKeyDown}>
      <button className="more-trigger" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu" role="menu" id={id}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" onClick={() => { setOpen(false); it.onSelect() }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}
