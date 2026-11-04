import type { ReactNode } from 'react'

interface Props {
  summary: ReactNode
  count: number
  busy: boolean
  onClear: () => void
  onApply: () => void
}

/** Barra fixa no rodapé da Limpeza: o resumo do que vai acontecer e o botão de mover para a Lixeira. */
export default function ActionBar({ summary, count, busy, onClear, onApply }: Props) {
  return (
    <div className="action-bar" role="region" aria-label="Ação da limpeza">
      <div className="action-summary">{summary}</div>
      <button onClick={onClear} disabled={busy || count === 0}>Desmarcar todos</button>
      <button className="primary" onClick={onApply} disabled={busy || count === 0}>Mover {count} para a Lixeira</button>
    </div>
  )
}
