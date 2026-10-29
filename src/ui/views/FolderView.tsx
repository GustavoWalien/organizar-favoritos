import { useMemo, useState } from 'react'
import type { FolderNode, FolderOption } from '../../core/folders'
import { normalizeText } from '../../core/text'
import type { BmLink } from '../../core/types'
import SelectableList from '../components/SelectableList'
import type { ViewMode } from '../viewMode'

interface Props {
  title: string
  links: BmLink[]
  subfolders: FolderNode[]
  mode: ViewMode
  onOpenFolder: (id: string) => void
  folderOptions: FolderOption[]
  busy: boolean
  onMove: (ids: string[], folderId: string) => void | Promise<void>
  onTrash: (ids: string[]) => void | Promise<void>
}

export default function FolderView({ title, links, subfolders, mode, onOpenFolder, folderOptions, busy, onMove, onTrash }: Props) {
  const [query, setQuery] = useState('')
  const q = normalizeText(query)
  const filtered = useMemo(
    () => (q ? links.filter((l) => normalizeText(`${l.title} ${l.url}`).includes(q)) : links),
    [links, q],
  )

  return (
    <section>
      <div className="view-head">
        <h2>{title || '(sem nome)'} <small>{links.length} {links.length === 1 ? 'favorito' : 'favoritos'}</small></h2>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar nesta pasta…" aria-label="Filtrar nesta pasta" />
      </div>
      {subfolders.length > 0 && (
        <div className="chips">
          {subfolders.map((f) => (
            <button key={f.id} className="chip" onClick={() => onOpenFolder(f.id)}>📁 {f.title || '(sem nome)'} <small>{f.count}</small></button>
          ))}
        </div>
      )}
      <SelectableList key={`${q}|${mode}`} links={filtered} mode={mode} folderOptions={folderOptions} busy={busy} onMove={onMove} onTrash={onTrash} />
    </section>
  )
}
