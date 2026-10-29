import { useState } from 'react'
import { buildFolderTree, directLinks, findFolderNode, folderPath, sidebarFolders, uncategorizedLinks } from '../../core/folders'
import { findTrash } from '../../core/cleanup'
import type { View } from '../../core/route'
import { flattenLinks } from '../../core/tree'
import Toast from '../components/Toast'
import { useLibrary } from '../state/useLibrary'
import BackupsTab from '../BackupsTab'
import CleanupTab from '../CleanupTab'
import OverviewTab from '../OverviewTab'
import FolderView from '../views/FolderView'
import TrashView from '../views/TrashView'
import { loadViewMode, saveViewMode, type ViewMode } from '../viewMode'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Shell() {
  const lib = useLibrary()
  const [view, setView] = useState<View>({ name: 'overview' })
  const [mode, setMode] = useState<ViewMode>(loadViewMode)

  const tree = lib.tree
  if (!tree) return <p className="loading">Lendo favoritos…</p>

  const folders = sidebarFolders(tree)
  const trash = findTrash(tree)
  const changeMode = (m: ViewMode) => { setMode(m); saveViewMode(m) }

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
    : ['Visão geral']
  const listView = view.name === 'folder' || view.name === 'uncategorized' || view.name === 'trash'

  let content
  if (view.name === 'folder') {
    const node = findFolderNode(buildFolderTree(tree), view.id)
    content = (
      <FolderView key={view.id} title={breadcrumb.at(-1) ?? ''} links={directLinks(tree, view.id)} subfolders={node?.children ?? []} mode={mode} onOpenFolder={(id) => setView({ name: 'folder', id })} />
    )
  } else if (view.name === 'uncategorized') {
    content = <FolderView key="uncategorized" title="Sem categoria" links={uncategorizedLinks(tree)} subfolders={[]} mode={mode} onOpenFolder={() => {}} />
  } else if (view.name === 'trash') {
    content = <TrashView tree={tree} mode={mode} busy={lib.busy} onChanged={lib.reload} onNotify={lib.notify} />
  } else if (view.name === 'cleanup') {
    content = <CleanupTab />
  } else if (view.name === 'backups') {
    content = <BackupsTab />
  } else {
    content = <OverviewTab />
  }

  return (
    <div className="shell">
      <Sidebar
        folders={folders}
        view={view}
        uncategorizedCount={uncategorizedLinks(tree).length}
        trashCount={trash ? flattenLinks([trash]).length : 0}
        onNavigate={setView}
        onNewFolder={newFolder}
      />
      <div className="main">
        <Topbar breadcrumb={breadcrumb} showViewMode={listView} mode={mode} onMode={changeMode} />
        <div className="content">{content}</div>
      </div>
      {lib.toast && (
        <Toast
          key={lib.toast.id}
          message={lib.toast.message}
          actionLabel={lib.toast.undoable ? 'Desfazer' : undefined}
          onAction={lib.undo}
          onClose={lib.dismissToast}
        />
      )}
    </div>
  )
}
