import { useState } from 'react'
import Icon, { type IconName } from '../components/Icon'
import { applyPref, loadPref, savePref, type ThemePref } from './theme'

const OPTIONS: { value: ThemePref; icon: IconName; label: string }[] = [
  { value: 'light', icon: 'sun', label: 'Tema claro' },
  { value: 'system', icon: 'contrast', label: 'Tema do sistema' },
  { value: 'dark', icon: 'moon', label: 'Tema escuro' },
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
          <Icon name={o.icon} size={14} />
        </button>
      ))}
    </div>
  )
}
