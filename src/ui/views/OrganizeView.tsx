import { useEffect, useMemo, useRef, useState } from 'react'
import { chromeBookmarksApi } from '../../chrome/bookmarksApi'
import type { FolderOption } from '../../core/folders'
import type { MarksMap } from '../../core/marks'
import { organizeRows, ownMarkedIds, type OrganizeFilters } from '../../core/organize'
import { hasMore, pageOf } from '../../core/paging'
import type { BmNode } from '../../core/types'
import ImportPreview from '../components/ImportPreview'
import MovePicker from '../components/MovePicker'
import SelectionBar from '../components/SelectionBar'
import { domainOf } from '../format'
import { applyImport, describeImport, exportStructureFile, importFileProblem, type ImportPreparation, previewImport } from '../marksActions'

interface Props {
  tree: BmNode[]
  marks: MarksMap
  folderOptions: FolderOption[]
  busy: boolean
  onMove: (ids: string[], folderId: string) => void | Promise<void>
  onSetProtected: (ids: string[], value: boolean) => void | Promise<void>
  /** Com `planId`, o aviso oferece "Desfazer" para esse plano. */
  onNotify: (message: string, undoable?: boolean, planId?: string) => void
  onChanged: () => Promise<unknown>
}

const NO_FILTERS: OrganizeFilters = { query: '', onlyLoose: false, onlyProtected: false, onlySuggested: false }
const APROVADO: Record<string, string> = { '': '—', sim: 'Aprovado', nao: 'Recusado' }

/** Tabela de revisão: todos os favoritos com pasta atual, marca "Não mexer" e sugestão, com filtros. */
export default function OrganizeView({ tree, marks, folderOptions, busy, onMove, onSetProtected, onNotify, onChanged }: Props) {
  const [filters, setFilters] = useState<OrganizeFilters>(NO_FILTERS)
  const [pages, setPages] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [picking, setPicking] = useState(false)
  const [importing, setImporting] = useState<{ prep: ImportPreparation; fileName: string } | null>(null)
  const [reading, setReading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const importButton = useRef<HTMLButtonElement>(null)

  const rows = useMemo(() => organizeRows(tree, marks, filters), [tree, marks, filters])
  const shown = useMemo(() => pageOf(rows, pages), [rows, pages])
  const shownIds = useMemo(() => new Set(shown.map((r) => r.id)), [shown])
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id))

  // A seleção só guarda o que está na tela: itens que saíram da página visível (movidos, filtrados,
  // apagados, ou além das páginas mostradas) deixam de estar selecionados.
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => shownIds.has(id)))
      return next.size === s.size ? s : next
    })
  }, [shownIds])

  const change = (patch: Partial<OrganizeFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPages(1) }
  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s)
    if (!next.delete(id)) next.add(id)
    return next
  })
  const toggleAll = () => setSelected((s) => (allShownSelected ? new Set([...s].filter((id) => !shownIds.has(id))) : new Set([...s, ...shownIds])))
  const ids = [...selected]
  const unprotect = () => {
    const own = ownMarkedIds(ids, marks)
    if (own.length === 0) onNotify('Nenhum selecionado tem a marca "não mexer" própria; os protegidos por uma pasta são liberados pela pasta')
    else void onSetProtected(own, false)
  }
  const filtering = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    const problem = importFileProblem(file)
    if (problem) {
      onNotify(problem)
      return
    }
    setReading(true)
    try {
      const prep = await previewImport(chromeBookmarksApi, marks, await file.text())
      setImporting({ prep, fileName: file.name })
    } catch (err) {
      onNotify(`Não foi possível ler o arquivo: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setReading(false)
    }
  }

  const applyChosen = async (chosen: Set<string>) => {
    if (!importing) return
    const r = await applyImport(chromeBookmarksApi, importing.prep, chosen, Date.now())
    setImporting(null)
    if (r.ran) await onChanged()
    onNotify(describeImport(r), r.planId !== undefined, r.planId)
  }

  return (
    <section>
      <div className="view-head">
        <h2>Organizar <small>{rows.length} {rows.length === 1 ? 'favorito' : 'favoritos'}</small></h2>
        <div className="view-actions">
          <button onClick={() => exportStructureFile(tree, marks, Date.now())} aria-describedby="export-hint">Exportar CSV</button>
          <small id="export-hint">No Google Planilhas: Arquivo → Importar → Upload</small>
          <button ref={importButton} onClick={() => fileInput.current?.click()} disabled={busy || reading}>{reading ? 'Lendo…' : 'Importar CSV…'}</button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void onFile(e) }} />
        </div>
      </div>
      <div className="toolbar organize-filters" role="search" aria-label="Filtros">
        <input type="search" value={filters.query} onChange={(e) => change({ query: e.target.value })} placeholder="Buscar por título, endereço ou pasta…" aria-label="Buscar favoritos" />
        <select value={filters.folderId ?? ''} onChange={(e) => change({ folderId: e.target.value || undefined })} aria-label="Pasta">
          <option value="">Todas as pastas</option>
          {folderOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label><input type="checkbox" checked={filters.onlyLoose} onChange={(e) => change({ onlyLoose: e.target.checked })} /> Só soltos</label>
        <label><input type="checkbox" checked={filters.onlyProtected} onChange={(e) => change({ onlyProtected: e.target.checked })} /> Só "Não mexer"</label>
        <label><input type="checkbox" checked={filters.onlySuggested} onChange={(e) => change({ onlySuggested: e.target.checked })} /> Só com sugestão</label>
        {filtering && <button onClick={() => { setFilters(NO_FILTERS); setPages(1) }}>Limpar filtros</button>}
      </div>

      {selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          busy={busy}
          onMoveTo={() => setPicking(true)}
          onProtect={() => { void onSetProtected(ids, true) }}
          onUnprotect={unprotect}
          onClear={() => setSelected(new Set())}
        />
      )}

      {rows.length === 0 ? (
        <p className="empty">{filtering ? 'Nenhum favorito combina com os filtros.' : 'Nenhum favorito aqui.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="organize-table">
            <thead>
              <tr>
                <th scope="col" className="col-check"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Selecionar todos os itens visíveis" /></th>
                <th scope="col">Favorito</th>
                <th scope="col">Pasta atual</th>
                <th scope="col" className="col-lock">Não mexer</th>
                <th scope="col">Sugestão</th>
                <th scope="col">Aprovado</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const title = r.title || domainOf(r.url) || '(sem título)'
                const inherited = !r.own && r.inheritedFrom !== undefined
                return (
                  <tr key={r.id} className={selected.has(r.id) ? 'selected' : undefined}>
                    <td className="col-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Selecionar ${title}`} /></td>
                    <td>
                      <div className="cell-title">
                        <a href={r.url} target="_blank" rel="noreferrer" className="row-title">{title}</a>
                        <span className="muted">{domainOf(r.url)}</span>
                      </div>
                    </td>
                    <td className="muted">{r.folderLabel || '—'}{r.loose && <small className="tag-loose"> · solto</small>}</td>
                    <td className="col-lock">
                      {inherited ? (
                        <span title={`Protegido pela pasta ${r.inheritedFrom}`}>
                          <input type="checkbox" checked disabled aria-label={`Não mexer: ${title} (protegido pela pasta ${r.inheritedFrom})`} /> <span aria-hidden="true">🔒</span>
                        </span>
                      ) : (
                        <input type="checkbox" checked={r.own} disabled={busy} onChange={() => { void onSetProtected([r.id], !r.own) }} aria-label={`Não mexer: ${title}`} />
                      )}
                    </td>
                    <td>{r.sugestao || <span className="muted">—</span>}</td>
                    <td className="muted">{APROVADO[r.aprovado]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasMore(rows, pages) && (
        <p><button onClick={() => setPages((p) => p + 1)}>Mostrar mais ({rows.length - shown.length} restantes)</button></p>
      )}

      {importing && (
        <ImportPreview
          prep={importing.prep}
          fileName={importing.fileName}
          busy={busy}
          onApply={applyChosen}
          onClose={() => setImporting(null)}
          returnFocusTo={importButton}
        />
      )}

      {picking && (
        <MovePicker
          options={folderOptions}
          count={selected.size}
          onClose={() => setPicking(false)}
          onPick={(folderId) => { setPicking(false); void onMove(ids, folderId); setSelected(new Set()) }}
        />
      )}
    </section>
  )
}
