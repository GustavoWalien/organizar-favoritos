import ThemeToggle from '../theme/ThemeToggle'
import type { ViewMode } from '../viewMode'

interface Props {
  breadcrumb: string[]
  showViewMode: boolean
  mode: ViewMode
  onMode: (mode: ViewMode) => void
  onOpenPalette: () => void
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'lista', label: '☰ Lista' },
  { value: 'cards', label: '▦ Cards' },
  { value: 'compacto', label: '≡ Compacto' },
]

export default function Topbar({ breadcrumb, showViewMode, mode, onMode, onOpenPalette }: Props) {
  const last = breadcrumb.length - 1
  return (
    <header className="topbar">
      <div className="breadcrumb" aria-label="Você está em">
        {breadcrumb.map((part, i) => (
          <span key={i}>{i > 0 && ' › '}{i === last ? <b>{part || '(sem nome)'}</b> : part || '(sem nome)'}</span>
        ))}
      </div>
      <div className="topbar-spacer" />
      <button className="search-pill" onClick={onOpenPalette} aria-label="Buscar ou ir para (Ctrl K)">
        🔍 Buscar ou ir para… <kbd>Ctrl K</kbd>
      </button>
      {showViewMode && (
        <div className="segmented" role="radiogroup" aria-label="Modo de visualização">
          {MODES.map((m) => (
            <button key={m.value} role="radio" aria-checked={mode === m.value} onClick={() => onMode(m.value)}>{m.label}</button>
          ))}
        </div>
      )}
      <ThemeToggle />
      <button disabled title="Disponível quando a IA for implementada">✨ Sugerir pastas · em breve</button>
    </header>
  )
}
