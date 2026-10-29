import React from 'react'
import ReactDOM from 'react-dom/client'

function Popup() {
  const abrirPainel = () => browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') })
  return (
    <div style={{ width: 220, padding: 12, display: 'grid', gap: 8, fontFamily: 'system-ui, sans-serif' }}>
      <button onClick={abrirPainel}>Abrir painel</button>
      <button disabled title="Disponível no marco 1">Fazer backup</button>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
