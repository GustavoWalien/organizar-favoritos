import { useState, type DragEvent } from 'react'
import { decodeDrag, DRAG_MIME } from '../../core/dragPayload'
import type { FolderNode } from '../../core/folders'
import type { View } from '../../core/route'

export type DropTarget = { kind: 'folder'; id: string } | { kind: 'uncategorized' } | { kind: 'trash' }

interface Props {
  folders: FolderNode[]
  view: View
  uncategorizedCount: number
  trashCount: number
  cleanupCount: number
  lockedFolderIds: Set<string>
  onToggleFolderLock: (id: string) => void
  onNavigate: (view: View) => void
  onNewFolder: () => void
  onDropLinks: (ids: string[], target: DropTarget) => void
}

type DropProps = (key: string, target: DropTarget) => {
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

const isCurrent = (view: View, name: View['name']) => view.name === name

function TreeItem({ node, depth, view, expanded, toggle, onNavigate, dropKey, dropProps, lockedFolderIds, onToggleFolderLock }: {
  node: FolderNode
  depth: number
  view: View
  expanded: Set<string>
  toggle: (id: string) => void
  onNavigate: (view: View) => void
  dropKey: string | null
  dropProps: DropProps
  lockedFolderIds: Set<string>
  onToggleFolderLock: (id: string) => void
}) {
  const open = expanded.has(node.id)
  const current = view.name === 'folder' && view.id === node.id
  const key = `folder:${node.id}`
  const locked = lockedFolderIds.has(node.id)
  const name = node.title || '(sem nome)'
  return (
    <>
      <div className={`tree-row${dropKey === key ? ' drop' : ''}`} style={{ paddingLeft: 6 + depth * 16 }} {...dropProps(key, { kind: 'folder', id: node.id })}>
        {node.children.length > 0 ? (
          <button className="chevron" aria-label={open ? `Recolher ${node.title}` : `Expandir ${node.title}`} aria-expanded={open} onClick={() => toggle(node.id)}>
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="chevron" aria-hidden="true" />
        )}
        <button className={`nav-item${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined} onClick={() => onNavigate({ name: 'folder', id: node.id })}>
          <span className="nav-label">📁 {name}{locked && <span className="lock" role="img" aria-label="Não mexer" title="Não mexer"> 🔒</span>}</span>
          <span className="count">{node.count}</span>
        </button>
        <button className={`lock-toggle${locked ? ' on' : ''}`} aria-label={locked ? `Liberar ${name}` : `Marcar ${name} como não mexer`} aria-pressed={locked} title={locked ? 'Liberar' : 'Não mexer'} onClick={() => onToggleFolderLock(node.id)}>
          {locked ? '🔓' : '🔒'}
        </button>
      </div>
      {open && node.children.map((c) => (
        <TreeItem key={c.id} node={c} depth={depth + 1} view={view} expanded={expanded} toggle={toggle} onNavigate={onNavigate} dropKey={dropKey} dropProps={dropProps} lockedFolderIds={lockedFolderIds} onToggleFolderLock={onToggleFolderLock} />
      ))}
    </>
  )
}

export default function Sidebar({ folders, view, uncategorizedCount, trashCount, cleanupCount, lockedFolderIds, onToggleFolderLock, onNavigate, onNewFolder, onDropLinks }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dropKey, setDropKey] = useState<string | null>(null)
  const toggle = (id: string) => setExpanded((s) => {
    const next = new Set(s)
    if (!next.delete(id)) next.add(id)
    return next
  })

  // Só aceita o que foi arrastado por esta extensão (DRAG_MIME); links ou texto de outras páginas passam direto.
  const dropProps: DropProps = (key, target) => ({
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropKey(key)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropKey((k) => (k === key ? null : k))
    },
    onDrop: (e) => {
      e.preventDefault()
      setDropKey(null)
      const ids = decodeDrag(e.dataTransfer.getData(DRAG_MIME))
      if (ids.length > 0) onDropLinks(ids, target)
    },
  })

  const item = (name: View['name'], label: string, to: View, badge = 0) => (
    <button className={`nav-item${isCurrent(view, name) ? ' active' : ''}`} aria-current={isCurrent(view, name) ? 'page' : undefined} onClick={() => onNavigate(to)}>
      <span className="nav-label">{label}</span>
      {badge > 0 && <span className="badge" aria-label={`${badge} itens para revisar`}>{badge}</span>}
    </button>
  )

  return (
    <aside className="sidebar" aria-label="Navegação">
      <div className="brand">🔖 Organizar Favoritos</div>
      <nav>
        {item('overview', '▦ Visão geral', { name: 'overview' })}
        {item('cleanup', '🧹 Limpeza', { name: 'cleanup' }, cleanupCount)}
        {item('organize', '☰ Organizar', { name: 'organize' })}
        {item('backups', '💾 Backups', { name: 'backups' })}
      </nav>
      <div className="section-title">
        <span>Pastas</span>
        <button className="link-button" onClick={onNewFolder}>+ nova</button>
      </div>
      <nav>
        {folders.map((f) => (
          <TreeItem key={f.id} node={f} depth={0} view={view} expanded={expanded} toggle={toggle} onNavigate={onNavigate} dropKey={dropKey} dropProps={dropProps} lockedFolderIds={lockedFolderIds} onToggleFolderLock={onToggleFolderLock} />
        ))}
        <div className={`tree-row${dropKey === 'uncategorized' ? ' drop' : ''}`} {...dropProps('uncategorized', { kind: 'uncategorized' })}>
          <button className={`nav-item${isCurrent(view, 'uncategorized') ? ' active' : ''}`} aria-current={isCurrent(view, 'uncategorized') ? 'page' : undefined} onClick={() => onNavigate({ name: 'uncategorized' })}>
            <span className="nav-label">❓ Sem categoria</span>
            <span className="count">{uncategorizedCount}</span>
          </button>
        </div>
        <div className={`tree-row${dropKey === 'trash' ? ' drop' : ''}`} {...dropProps('trash', { kind: 'trash' })}>
          <button className={`nav-item trash${isCurrent(view, 'trash') ? ' active' : ''}`} aria-current={isCurrent(view, 'trash') ? 'page' : undefined} onClick={() => onNavigate({ name: 'trash' })}>
            <span className="nav-label">🗑 Lixeira</span>
            <span className="count">{trashCount}</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}
