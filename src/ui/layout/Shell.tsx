import { useEffect, useMemo, useState } from 'react'
import { buildFolderTree, directLinks, findFolderNode, folderOptions, folderPath, linksInSubfolders, sidebarFolders, uncategorizedLinks } from '../../core/folders'
import { findTrash } from '../../core/cleanup'
import type { PaletteAction } from '../../core/palette'
import type { View } from '../../core/route'
import { flattenLinks, otherBookmarksId } from '../../core/tree'
import CommandPalette from '../components/CommandPalette'
import MovePicker from '../components/MovePicker'
import Toast from '../components/Toast'
import { requestLinkCheckPermission } from '../../chrome/permissions'
import { makeBackup } from '../backupActions'
import { useLibrary } from '../state/useLibrary'
import { useRoute } from '../state/useRoute'
import { useDashboard } from '../state/useDashboard'
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
  const [route, setView] = useRoute()
  const [mode, setMode] = useState<ViewMode>(loadViewMode)

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moveIds, setMoveIds] = useState<string[] | null>(null)
  const [autoTestToken, setAutoTestToken] = useState(0)

  const tree = lib.tree
  const allLinks = useMemo(() => (tree ? flattenLinks(tree, findTrash(tree)?.id) : []), [tree])

  const dash = useDashboard(tree)

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

  // Pasta que não existe mais (apagada por fora, endereço antigo): corrige o endereço para a Visão geral.
  const missingFolder = !!tree && route.name === 'folder' && !findFolderNode(buildFolderTree(tree), route.id)
  useEffect(() => {
    if (missingFolder) setView({ name: 'overview' }, { replace: true })
  }, [missingFolder, setView])

  if (!tree || !dash.dashboard) return <p className="loading">Lendo favoritos…</p>
  const dashboard = dash.dashboard

  const view: View = missingFolder ? { name: 'overview' } : route

  const folders = sidebarFolders(tree)
  const options = folderOptions(tree)
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

  /** "Testar agora" fora da Limpeza: pede a permissão no próprio clique e abre a aba já testando. */
  const startLinkCheck = () => {
    requestLinkCheckPermission().then((ok) => {
      if (!ok) { lib.notify('Sem a permissão de acesso aos sites não dá para testar os links'); return }
      setAutoTestToken((n) => n + 1)
      setView({ name: 'cleanup', tab: 'quebrados' })
    }, (e) => lib.notify(`Erro: ${e instanceof Error ? e.message : String(e)}`))
  }

  const backupNow = () => {
    makeBackup().then(() => { lib.notify('Backup feito'); void dash.refresh() }, (e) => lib.notify(`Erro: ${e instanceof Error ? e.message : String(e)}`))
  }

  const runAction = (action: PaletteAction) => {
    setPaletteOpen(false)
    if (action === 'backup') backupNow()
    else if (action === 'analisar-sem-uso') setView({ name: 'cleanup', tab: 'sem-uso' })
    else if (action === 'achar-duplicados') setView({ name: 'cleanup', tab: 'duplicados' })
    else if (action === 'testar-links') startLinkCheck()
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
    : []
  const listView = breadcrumb.length > 0

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
    content = (
      <CleanupView
        tab={view.tab}
        prefs={dash.prefs}
        linkCheck={dash.linkCheck}
        autoTestToken={autoTestToken}
        onTab={(tab) => setView({ name: 'cleanup', tab })}
        onPrefs={dash.setPrefs}
        onLinkCheck={dash.setLinkCheck}
        onNotify={lib.notify}
      />
    )
  } else if (view.name === 'organize') {
    content = <OrganizeView tree={tree} marks={lib.marks} folderOptions={options} busy={lib.busy} onMove={lib.move} onSetProtected={lib.setProtected} onNotify={lib.notify} onChanged={lib.reload} />
  } else if (view.name === 'backups') {
    content = <BackupsView tree={tree} lastExportAt={dash.lastExportAt} onChanged={() => { void dash.refresh() }} />
  } else {
    content = (
      <OverviewView
        dashboard={dashboard}
        steps={dash.steps}
        recent={dash.recent}
        lastBackupAt={dash.lastBackupAt}
        busy={lib.busy}
        onNavigate={setView}
        onTestLinks={startLinkCheck}
        onBackup={backupNow}
        onUndo={(planId) => { void lib.undo(planId) }}
      />
    )
  }

  return (
    <div className="shell">
      <Sidebar
        folders={folders}
        view={view}
        dashboard={dashboard}
        lastBackupAt={dash.lastBackupAt}
        onNavigate={setView}
        onNewFolder={newFolder}
        onDropLinks={dropLinks}
      />
      <div className="main">
        <Topbar breadcrumb={breadcrumb} showViewMode={listView} mode={mode} busy={lib.busy} onMode={changeMode} onOpenPalette={() => setPaletteOpen(true)} onBackup={backupNow} />
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
