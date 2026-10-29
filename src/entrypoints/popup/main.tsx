import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { makeBackup } from '../../ui/backupActions'

function Popup() {
  const [status, setStatus] = useState<string | null>(null)
  const abrirPainel = () => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') })
  const backup = async () => {
    setStatus('Fazendo backup…')
    try {
      await makeBackup()
      setStatus('Backup feito.')
    } catch (e) {
      setStatus(`Erro: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return (
    <div style={{ width: 220, padding: 12, display: 'grid', gap: 8, fontFamily: 'system-ui, sans-serif', background: 'var(--bg, #14171d)', color: 'var(--text, #e8eaed)' }}>
      <button onClick={abrirPainel}>Abrir painel</button>
      <button onClick={backup}>Fazer backup</button>
      {status && <small role="status">{status}</small>}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
