import { applyPref, loadPref } from './theme'

// Roda antes do React: aplica o tema salvo e acompanha o sistema quando a preferência é "Sistema".
applyPref(loadPref())
try {
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (loadPref() === 'system') applyPref('system')
  })
} catch {
  // sem matchMedia: o tema fica como foi aplicado
}
