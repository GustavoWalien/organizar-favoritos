import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ImportKind } from '../../core/importPlan'
import { hasMore, pageOf } from '../../core/paging'
import { importSummary, nothingToImportMessage, type ImportPreparation } from '../marksActions'

interface Props {
  prep: ImportPreparation
  fileName: string
  /** Outra ação está mudando os favoritos: "Aplicar" espera. */
  busy: boolean
  /** Aplica os itens escolhidos; se rejeitar, o erro aparece no diálogo. */
  onApply: (selected: Set<string>) => Promise<void>
  onClose: () => void
  /** Quem recebe o foco ao fechar; sem ele, volta para o elemento focado ao abrir. */
  returnFocusTo?: React.RefObject<HTMLElement | null>
}

const KIND: Record<ImportKind, string> = {
  'criar-pasta': 'Nova pasta',
  'criar-link': 'Novo favorito',
  mover: 'Mover',
  marcar: 'Marcas',
}

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

/** Lista longa mostrada de 200 em 200, para não travar a página. */
function PagedSection<T>({ title, list, render }: { title: string; list: T[]; render: (item: T) => ReactNode }) {
  const [pages, setPages] = useState(1)
  const id = useId()
  if (list.length === 0) return null
  const shown = pageOf(list, pages)
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{title} <small>{list.length}</small></h3>
      <ul className="import-list">
        {shown.map((item, i) => <li key={i}>{render(item)}</li>)}
      </ul>
      {hasMore(list, pages) && <button onClick={() => setPages((p) => p + 1)}>Mostrar mais ({list.length - shown.length} restantes)</button>}
    </section>
  )
}

/** Prévia da importação do CSV: o que será criado, movido e marcado, com uma caixa por item. */
export default function ImportPreview({ prep, fileName, busy, onApply, onClose, returnFocusTo }: Props) {
  const { preview, issues, fatal } = prep
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preview.items.map((i) => i.key)))
  const [pages, setPages] = useState(1)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const summaryId = useId()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const target = returnFocusTo
    dialog.current?.focus()
    return () => (target?.current ?? opener)?.focus?.() // devolve o foco a quem abriu o diálogo
  }, [returnFocusTo])

  const close = () => { if (!applying) onClose() }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab' && dialog.current) {
      // O foco circula dentro do diálogo.
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) { e.preventDefault(); return }
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === dialog.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
  }

  const toggle = (key: string) => setSelected((s) => {
    const next = new Set(s)
    if (!next.delete(key)) next.add(key)
    return next
  })

  const apply = async () => {
    if (selected.size === 0 || applying) return
    setApplying(true)
    setError(null)
    try {
      await onApply(selected)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const shown = pageOf(preview.items, pages)
  const nothing = !fatal && preview.items.length === 0

  return (
    <div className="backdrop" onMouseDown={close}>
      <div
        ref={dialog}
        className="dialog import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        aria-busy={applying}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="dialog-head">Importar {fileName}</h2>

        {fatal ? (
          <p id={summaryId} className="import-error" role="alert">Não foi possível importar: {fatal}</p>
        ) : (
          <p id={summaryId} className={nothing ? undefined : 'muted'}>{nothing ? nothingToImportMessage(prep) : importSummary(preview, selected)}</p>
        )}

        {!fatal && (
          <div className="import-body">
            {preview.items.length > 0 && (
              <section aria-labelledby={`${titleId}-items`}>
                <div className="import-section-head">
                  <h3 id={`${titleId}-items`}>Mudanças <small>{selected.size} de {preview.items.length} escolhidas</small></h3>
                  <button onClick={() => setSelected(new Set(preview.items.map((i) => i.key)))} disabled={applying || selected.size === preview.items.length}>Marcar todas</button>
                  <button onClick={() => setSelected(new Set())} disabled={applying || selected.size === 0}>Desmarcar todas</button>
                </div>
                <ul className="import-list">
                  {shown.map((i) => (
                    <li key={i.key}>
                      <label>
                        <input type="checkbox" checked={selected.has(i.key)} onChange={() => toggle(i.key)} disabled={applying} />
                        <span className="import-item">
                          <span><span className="tag">{KIND[i.kind]}</span> {i.label || '(sem título)'}</span>
                          {i.detail && <small>{i.detail}</small>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {hasMore(preview.items, pages) && (
                  <button onClick={() => setPages((p) => p + 1)}>Mostrar mais ({preview.items.length - shown.length} restantes)</button>
                )}
              </section>
            )}
            <PagedSection
              title="Bloqueados por não mexer"
              list={preview.blocked}
              render={(b) => <span className="import-item"><span>{b.label || '(sem título)'}</span><small>{b.reason}</small></span>}
            />
            <PagedSection
              title="Ignorados"
              list={preview.ignored}
              render={(b) => <span className="import-item"><span>{b.label || '(sem título)'}</span><small>{b.reason}</small></span>}
            />
            <PagedSection
              title="Linhas que não puderam ser lidas"
              list={issues}
              render={(i) => <span className="import-item"><span>Linha {i.line}</span><small>{i.message}</small></span>}
            />
          </div>
        )}

        {error && <p className="import-error" role="alert">{error}</p>}

        <div className="dialog-actions">
          <button onClick={close} disabled={applying}>{fatal || nothing ? 'Fechar' : 'Cancelar'}</button>
          {!fatal && !nothing && (
            <button className="primary" onClick={() => { void apply() }} disabled={applying || busy || selected.size === 0}>
              {applying ? 'Aplicando…' : 'Aplicar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
