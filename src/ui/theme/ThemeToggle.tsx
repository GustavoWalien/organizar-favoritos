import { useState } from 'react'
import { applyPref, loadPref, savePref, type ThemePref } from './theme'

const OPTIONS: { value: ThemePref; icon: string; label: string }[] = [
  { value: 'light', icon: '☀', label: 'Tema claro' },
  { value: 'system', icon: '◐', label: 'Tema do sistema' },
  { value: 'dark', icon: '☾', label: 'Tema escuro' },
]

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(loadPref)
  const choose = (value: ThemePref) => {
    setPref(value)
    savePref(value)
    applyPref(value)
  }
  return (
    <div className="segmented" role="radiogroup" aria-label="Tema">
      {OPTIONS.map((o) => (
        <button key={o.value} role="radio" aria-checked={pref === o.value} aria-label={o.label} title={o.label} onClick={() => choose(o.value)}>
          {o.icon}
        </button>
      ))}
    </div>
  )
}
