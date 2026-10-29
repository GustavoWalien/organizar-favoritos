import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { DRAG_MIME, encodeDrag, idsToDrag } from '../../core/dragPayload'
import type { FolderOption } from '../../core/folders'
import type { BmLink } from '../../core/types'
import type { ViewMode } from '../viewMode'
import LinkList from './LinkList'
import MovePicker from './MovePicker'
import SelectionBar from './SelectionBar'

interface Props {
  links: BmLink[]
  mode: ViewMode
  folderOptions: FolderOption[]
  busy: boolean
  onMove: (ids: string[], folderId: string) => void | Promise<void>
  onTrash?: (ids: string[]) => void | Promise<void>
}

/** LinkList com seleção, barra de ações, "Mover para…" e itens arrastáveis. */
export default function SelectableList({ links, mode, folderOptions, busy, onMove, onTrash }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false)

  // Itens que saíram da lista (movidos, apagados) deixam de estar selecionados.
  const present = useMemo(() => new Set(links.map((l) => l.id)), [links])
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => present.has(id)))
      return next.size === s.size ? s : next
    })
  }, [present])

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const toggleAll = (ids: string[]) => setSelected((s) => (ids.every((id) => s.has(id)) ? new Set() : new Set([...s, ...ids])))
  const dragStart = (id: string, e: DragEvent) => {
    e.dataTransfer.setData(DRAG_MIME, encodeDrag(idsToDrag(id, selected)))
    e.dataTransfer.effectAllowed = 'move'
  }
  const ids = [...selected]

  return (
    <div>
      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          busy={busy}
          onMoveTo={() => setPicking(true)}
          onTrash={onTrash ? () => { void onTrash(ids); setSelected(new Set()) } : undefined}
          onClear={() => setSelected(new Set())}
        />
      )}
      <LinkList links={links} mode={mode} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onDragStart={dragStart} />
      {picking && (
        <MovePicker
          options={folderOptions}
          count={selected.size}
          onClose={() => setPicking(false)}
          onPick={(folderId) => { setPicking(false); void onMove(ids, folderId); setSelected(new Set()) }}
        />
      )}
    </div>
  )
}
