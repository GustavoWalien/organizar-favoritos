import { useEffect, useMemo, useState } from 'react'
import { buildFolderTree, directLinks, findFolderNode, folderOptions, folderPath, linksInSubfolders, sidebarFolders, uncategorizedLinks } from '../../core/folders'
import { findTrash } from '../../core/cleanup'
import type { PaletteAction } from '../../core/palette'
import type { View } from '../../core/route'
import { lockedFolderIds } from '../../core/organize'
import { computeOverview } from '../../core/overview'
import { flattenLinks, otherBookmarksId } from '../../core/tree'
import CommandPalette from '../components/CommandPalette'
import MovePicker from '../components/MovePicker'
import Toast from '../components/Toast'
import { makeBackup } from '../backupActions'
import { useLibrary } from '../state/useLibrary'
import BackupsView from '../views/BackupsView'
import CleanupView from '../views/CleanupView'
import OrganizeView from '../views/OrganizeView'
import OverviewView from '../views/OverviewView'
import FolderView from '../views/FolderView'
import TrashView from '../views/TrashView'
import { loadViewMode, saveViewMode, type ViewMode } from '../viewMode'
import Sidebar, { type DropTarget } from './Sidebar'
import Topbar from './Topbar'

export default function Shell() {
  const lib = useLibrary()
  const [view, setView] = useState<View>({ name: 'overview' })
  const [mode, setMode] = useState<ViewMode>(loadViewMode)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moveIds, setMoveIds] = useState<string[] | null>(null)

  const tree = lib.tree
  const allLinks = useMemo(() => (tree ? flattenLinks(tree, findTrash(tree)?.id) : []), [tree])

  const locked = useMemo(() => lockedFolderIds(lib.marks), [lib.marks])

  const overview = useMemo(() => (tree ? computeOverview(tree, Date.now()) : null), [tree])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!tree) return <p className="loading">Lendo favoritos…</p>

  const folders = sidebarFolders(tree)
  const options = folderOptions(tree)
  const trash = findTrash(tree)
  const changeMode = (m: ViewMode) => { setMode(m); saveViewMode(m) }

  const dropLinks = (ids: string[], target: DropTarget) => {
    if (target.kind === 'folder') void lib.move(ids, target.id)
    else if (target.kind === 'uncategorized') {
      // Só sai de lugar o que está numa subpasta ou na Lixeira; o que já está solto numa pasta raiz fica onde está.
      const movable = linksInSubfolders(tree, ids)
      if (movable.length === 0) lib.notify('Esses favoritos já estão sem categoria')
      else void lib.move(movable, otherBookmarksId(tree))
    }
    else void lib.trash(ids)
  }

  const runAction = (action: PaletteAction) => {
    setPaletteOpen(false)
    if (action === 'backup') {
      makeBackup().then(() => lib.notify('Backup feito'), (e) => lib.notify(`Erro: ${e instanceof Error ? e.message : String(e)}`))
    } else if (action === 'analisar-sem-uso') setView({ name: 'cleanup', start: 'sem-uso' })
    else if (action === 'achar-duplicados') setView({ name: 'cleanup', start: 'duplicado' })
    else if (action === 'testar-links') setView({ name: 'cleanup', start: 'quebrado' })
    else if (action === 'abrir-organizar') setView({ name: 'organize' })
    else setView({ name: 'trash' })
  }

  const newFolder = () => {
    const name = window.prompt('Nome da nova pasta')
    if (name !== null) void lib.createFolder(name, view.name === 'folder' ? view.id : undefined)
  }

  const breadcrumb =
    view.name === 'folder' ? folderPath(tree, view.id)
    : view.name === 'uncategorized' ? ['Sem categoria']
    : view.name === 'trash' ? ['Lixeira']
    : view.name === 'cleanup' ? ['Limpeza']
    : view.name === 'backups' ? ['Backups']
    : view.name === 'organize' ? ['Organizar']
    : ['Visão geral']
  const listView = view.name === 'folder' || view.name === 'uncategorized' || view.name === 'trash' || view.name === 'overview'

  let content
  if (view.name === 'folder') {
    const node = findFolderNode(buildFolderTree(tree), view.id)
    content = (
      <FolderView key={view.id} title={breadcrumb.at(-1) ?? ''} links={directLinks(tree, view.id)} subfolders={node?.children ?? []} mode={mode} onOpenFolder={(id) => setView({ name: 'folder', id })} folderOptions={options} busy={lib.busy} onMove={lib.move} onTrash={lib.trash} />
    )
  } else if (view.name === 'uncategorized') {
    content = <FolderView key="uncategorized" title="Sem categoria" links={uncategorizedLinks(tree)} subfolders={[]} mode={mode} onOpenFolder={() => {}} folderOptions={options} busy={lib.busy} onMove={lib.move} onTrash={lib.trash} />
  } else if (view.name === 'trash') {
    content = <TrashView tree={tree} mode={mode} busy={lib.busy} onChanged={lib.reload} onNotify={lib.notify} folderOptions={options} onMove={lib.move} />
  } else if (view.name === 'cleanup') {
    content = <CleanupView key={`cleanup-${view.start ?? ''}`} start={view.start} />
  } else if (view.name === 'organize') {
    content = <OrganizeView tree={tree} marks={lib.marks} folderOptions={options} busy={lib.busy} onMove={lib.move} onSetProtected={lib.setProtected} onNotify={lib.notify} onChanged={lib.reload} />
  } else if (view.name === 'backups') {
    content = <BackupsView />
  } else {
    content = <OverviewView tree={tree} overview={overview!} mode={mode} folderOptions={options} busy={lib.busy} onNavigate={setView} onMove={lib.move} onTrash={lib.trash} />
  }

  return (
    <div className="shell">
      <Sidebar
        folders={folders}
        view={view}
        uncategorizedCount={uncategorizedLinks(tree).length}
        cleanupCount={overview ? overview.inactive + overview.duplicates : 0}
        trashCount={trash ? flattenLinks([trash]).length : 0}
        lockedFolderIds={locked}
        onToggleFolderLock={(id) => { void lib.setProtected([id], !locked.has(id), 'pasta') }}
        onNavigate={setView}
        onNewFolder={newFolder}
        onDropLinks={dropLinks}
      />
      <div className="main">
        <Topbar breadcrumb={breadcrumb} showViewMode={listView} mode={mode} onMode={changeMode} onOpenPalette={() => setPaletteOpen(true)} />
        <div className="content">{content}</div>
      </div>
      {paletteOpen && (
        <CommandPalette
          links={allLinks}
          folders={options}
          onClose={() => setPaletteOpen(false)}
          onPickLink={(_id, parentId) => { setPaletteOpen(false); setView({ name: 'folder', id: parentId }) }}
          onMoveLink={(id) => { setPaletteOpen(false); setMoveIds([id]) }}
          onPickFolder={(id) => { setPaletteOpen(false); setView({ name: 'folder', id }) }}
          onAction={runAction}
        />
      )}
      {moveIds && (
        <MovePicker options={options} count={moveIds.length} onClose={() => setMoveIds(null)} onPick={(folderId) => { void lib.move(moveIds, folderId); setMoveIds(null) }} />
      )}
      {lib.toast && (
        <Toast
          key={lib.toast.id}
          message={lib.toast.message}
          actionLabel={lib.toast.undoable ? 'Desfazer' : undefined}
          onAction={() => lib.undo(lib.toast?.planId)}
          onClose={lib.dismissToast}
        />
      )}
    </div>
  )
}
