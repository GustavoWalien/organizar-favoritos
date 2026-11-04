import { useState, type DragEvent } from 'react'
import type { Dashboard } from '../../core/dashboard'
import { decodeDrag, DRAG_MIME } from '../../core/dragPayload'
import { expandableIds, type FolderNode } from '../../core/folders'
import type { View } from '../../core/route'
import Icon, { type IconName } from '../components/Icon'
import { ageLabel } from '../format'

export type DropTarget = { kind: 'folder'; id: string } | { kind: 'uncategorized' } | { kind: 'trash' }

interface Props {
  folders: FolderNode[]
  view: View
  dashboard: Dashboard
  lastBackupAt: number | null
  onNavigate: (view: View) => void
  onNewFolder: () => void
  onDropLinks: (ids: string[], target: DropTarget) => void
}

type DropProps = (key: string, target: DropTarget) => {
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

const BACKUP_FRESH_MS = 7 * 86_400_000

function TreeItem({ node, depth, view, expanded, toggle, onNavigate, dropKey, dropProps }: {
  node: FolderNode
  depth: number
  view: View
  expanded: Set<string>
  toggle: (id: string) => void
  onNavigate: (view: View) => void
  dropKey: string | null
  dropProps: DropProps
}) {
  const open = expanded.has(node.id)
  const current = view.name === 'folder' && view.id === node.id
  const key = `folder:${node.id}`
  const name = node.title || '(sem nome)'
  return (
    <>
      <div className={`tree-row${dropKey === key ? ' drop' : ''}`} style={{ paddingLeft: 4 + depth * 16 }} {...dropProps(key, { kind: 'folder', id: node.id })}>
        {node.children.length > 0 ? (
          <button className="chevron" aria-label={open ? `Recolher ${name}` : `Expandir ${name}`} aria-expanded={open} onClick={() => toggle(node.id)}>
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
          </button>
        ) : (
          <span className="chevron" aria-hidden="true" />
        )}
        <button className={`nav-item folder${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined} onClick={() => onNavigate({ name: 'folder', id: node.id })}>
          <Icon name="folder" size={14} />
          <span className="nav-label">{name}</span>
          <span className="count">{node.count}</span>
        </button>
      </div>
      {open && node.children.map((c) => (
        <TreeItem key={c.id} node={c} depth={depth + 1} view={view} expanded={expanded} toggle={toggle} onNavigate={onNavigate} dropKey={dropKey} dropProps={dropProps} />
      ))}
    </>
  )
}

export default function Sidebar({ folders, view, dashboard, lastBackupAt, onNavigate, onNewFolder, onDropLinks }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dropKey, setDropKey] = useState<string | null>(null)
  const allIds = expandableIds(folders)
  const allOpen = allIds.every((id) => expanded.has(id))
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

  const item = (name: View['name'], icon: IconName, label: string, to: View, extra?: React.ReactNode) => {
    const current = view.name === name
    return (
      <button className={`nav-item${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined} onClick={() => onNavigate(to)}>
        <Icon name={icon} />
        <span className="nav-label">{label}</span>
        {extra}
      </button>
    )
  }

  const now = Date.now()
  const backupFresh = lastBackupAt !== null && now - lastBackupAt <= BACKUP_FRESH_MS

  return (
    <aside className="sidebar" aria-label="Navegação">
      <div className="brand">
        <span className="brand-mark"><Icon name="bookmark" /></span>
        Organizar Favoritos
      </div>
      <nav>{item('overview', 'grid', 'Visão geral', { name: 'overview' })}</nav>

      <div className="section-title"><span>Tarefas</span></div>
      <nav>
        {item('cleanup', 'broom', 'Limpeza', { name: 'cleanup' },
          dashboard.review > 0 && <span className="badge" aria-label={`${dashboard.review} a revisar`}>{dashboard.review}</span>)}
        {item('organize', 'list', 'Organizar', { name: 'organize' },
          dashboard.uncategorized > 0 && <span className="count">{dashboard.uncategorized} soltos</span>)}
        <button className="nav-item" disabled title="Disponível quando a IA for implementada">
          <Icon name="sparkle" />
          <span className="nav-label">Sugestões da IA</span>
          <span className="pill">em breve</span>
        </button>
      </nav>

      <div className="section-title">
        <span>Pastas</span>
        <span className="section-actions">
          <button className="icon-button" onClick={() => setExpanded(new Set(allIds))} disabled={allIds.length === 0 || allOpen} aria-label="Expandir todas as pastas" title="Expandir todas as pastas"><Icon name="expand-all" size={14} /></button>
          <button className="icon-button" onClick={() => setExpanded(new Set())} disabled={expanded.size === 0} aria-label="Recolher todas as pastas" title="Recolher todas as pastas"><Icon name="collapse-all" size={14} /></button>
          <button className="icon-button" onClick={onNewFolder} aria-label="Nova pasta" title="Nova pasta"><Icon name="plus" size={14} /></button>
        </span>
      </div>
      <nav className="folder-tree">
        {folders.map((f) => (
          <TreeItem key={f.id} node={f} depth={0} view={view} expanded={expanded} toggle={toggle} onNavigate={onNavigate} dropKey={dropKey} dropProps={dropProps} />
        ))}
        <div className={`tree-row${dropKey === 'uncategorized' ? ' drop' : ''}`} style={{ paddingLeft: 4 }} {...dropProps('uncategorized', { kind: 'uncategorized' })}>
          <span className="chevron" aria-hidden="true" />
          <button className={`nav-item folder${view.name === 'uncategorized' ? ' active' : ''}`} aria-current={view.name === 'uncategorized' ? 'page' : undefined} onClick={() => onNavigate({ name: 'uncategorized' })}>
            <Icon name="folder" size={14} />
            <span className="nav-label">Sem categoria</span>
            <span className="count">{dashboard.uncategorized}</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className={`tree-row${dropKey === 'trash' ? ' drop' : ''}`} {...dropProps('trash', { kind: 'trash' })}>
          {item('trash', 'trash', 'Lixeira', { name: 'trash' }, <span className="count">{dashboard.trash}</span>)}
        </div>
        {item('backups', 'archive', 'Backups', { name: 'backups' },
          <span className={backupFresh ? 'age ok' : 'age warn'}>{lastBackupAt === null ? 'nenhum' : ageLabel(lastBackupAt, now)}</span>)}
      </div>
    </aside>
  )
}
