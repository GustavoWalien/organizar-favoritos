interface Props {
  count: number
  busy: boolean
  onMoveTo: () => void
  onTrash?: () => void
  onClear: () => void
}

export default function SelectionBar({ count, busy, onMoveTo, onTrash, onClear }: Props) {
  return (
    <div className="selection-bar" role="region" aria-label="Itens selecionados">
      <b>{count} {count === 1 ? 'selecionado' : 'selecionados'}</b>
      <div className="topbar-spacer" />
      <button className="primary" onClick={onMoveTo} disabled={busy}>Mover para…</button>
      {onTrash && <button className="danger" onClick={onTrash} disabled={busy}>🗑 Lixeira</button>}
      <button onClick={onClear}>Limpar</button>
    </div>
  )
}
