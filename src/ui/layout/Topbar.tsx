import Icon from '../components/Icon'
import ThemeToggle from '../theme/ThemeToggle'
import type { ViewMode } from '../viewMode'

interface Props {
  /** Caminho da pasta aberta; vazio nas outras telas. */
  breadcrumb: string[]
  showViewMode: boolean
  mode: ViewMode
  busy: boolean
  onMode: (mode: ViewMode) => void
  onOpenPalette: () => void
  onBackup: () => void
}

const MODES: { value: ViewMode; label: string }[] = [
  { value: 'lista', label: 'Lista' },
  { value: 'cards', label: 'Cards' },
  { value: 'compacto', label: 'Compacto' },
]

export default function Topbar({ breadcrumb, showViewMode, mode, busy, onMode, onOpenPalette, onBackup }: Props) {
  const last = breadcrumb.length - 1
  return (
    <header className="topbar">
      <button className="search-pill" onClick={onOpenPalette} aria-label="Buscar ou executar comando (Ctrl K)">
        <Icon name="search" />
        <span>Buscar favoritos, pastas ou ações…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar-spacer" />
      <button onClick={onBackup} disabled={busy}><Icon name="archive" /> Fazer backup</button>
      <ThemeToggle />
      {breadcrumb.length > 0 && (
        <div className="topbar-sub">
          <div className="breadcrumb" aria-label="Você está em">
            {breadcrumb.map((part, i) => (
              <span key={i}>{i > 0 && ' › '}{i === last ? <b>{part || '(sem nome)'}</b> : part || '(sem nome)'}</span>
            ))}
          </div>
          {showViewMode && (
            <div className="segmented" role="radiogroup" aria-label="Modo de visualização">
              {MODES.map((m) => (
                <button key={m.value} role="radio" aria-checked={mode === m.value} onClick={() => onMode(m.value)}>{m.label}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
