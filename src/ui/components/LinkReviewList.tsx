import type { Candidate, Reason } from '../selection'

export const REASON_LABEL: Record<Reason, string> = {
  'sem-uso': 'Sem uso',
  'sem-registro': 'Sem registro de uso',
  duplicado: 'Duplicado',
  quebrado: 'Quebrado',
  incerto: 'Incerto',
  'pasta-vazia': 'Pasta vazia',
}

interface Props {
  items: Candidate[]
  selected: Set<string>
  onToggle: (id: string) => void
}

export default function LinkReviewList({ items, selected, onToggle }: Props) {
  return (
    <ul className="review">
      {items.map((c) => (
        <li key={c.id}>
          <label>
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => onToggle(c.id)} />{' '}
            <strong>{c.title || c.url || '(sem título)'}</strong>
          </label>{' '}
          {c.url && <a href={c.url} target="_blank" rel="noreferrer">abrir</a>}
          <div>
            <small>{c.path.join(' / ')}</small>{' '}
            {c.reasons.map((r) => <span key={r} className={`tag tag-${r}`}>{REASON_LABEL[r]}</span>)}
            {c.reasons.length === 1 && c.reasons[0] === 'incerto' && (
              <small> — o site não respondeu como esperado; pode estar só bloqueando testes.</small>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
