import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import { findTrash } from '../../core/cleanup'
import { BackupFailedError, runPlan } from '../../core/plan'
import { flattenLinks } from '../../core/tree'
import type { BmNode } from '../../core/types'
import LinkList from '../components/LinkList'
import { preparePurge } from '../cleanupActions'
import type { ViewMode } from '../viewMode'

interface Props {
  tree: BmNode[]
  mode: ViewMode
  busy: boolean
  onChanged: () => Promise<unknown>
  onNotify: (message: string) => void
}

export default function TrashView({ tree, mode, busy, onChanged, onNotify }: Props) {
  const trash = findTrash(tree)
  const links = trash ? flattenLinks([trash]) : []

  const purge = async () => {
    try {
      const { plan, count } = await preparePurge(chromeBookmarksApi)
      if (plan.operations.length === 0) {
        onNotify('A Lixeira já está vazia')
        return
      }
      if (!window.confirm(`Apagar DE VEZ ${count} favorito(s) da Lixeira?\n\nO botão Desfazer NÃO recupera isso. Só o último backup, na aba Backups.`)) return
      const r = await runPlan(plan, chromeBookmarksApi, Date.now())
      onNotify(r.failed.length ? `Falhou: ${r.failed[0]?.error}` : 'Lixeira esvaziada')
    } catch (e) {
      onNotify(e instanceof BackupFailedError ? e.message : `Erro: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      await onChanged()
    }
  }

  return (
    <section>
      <div className="view-head">
        <h2>Lixeira <small>{links.length} {links.length === 1 ? 'favorito' : 'favoritos'}</small></h2>
        {trash && <button onClick={purge} disabled={busy}>Esvaziar a Lixeira…</button>}
      </div>
      <p className="muted">O que a limpeza descarta fica aqui até você esvaziar. Para recuperar, use o Desfazer ou a aba Backups.</p>
      <LinkList links={links} mode={mode} />
    </section>
  )
}
