import { useState } from 'react'
import BackupsTab from '../../ui/BackupsTab'
import CleanupTab from '../../ui/CleanupTab'
import OverviewTab from '../../ui/OverviewTab'

const TABS = ['Visão geral', 'Limpeza', 'Backups'] as const
type Tab = (typeof TABS)[number]

export default function App() {
  const [tab, setTab] = useState<Tab>('Visão geral')

  return (
    <main className="app">
      <h1>Organizar Favoritos</h1>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <section role="tabpanel">
        {tab === 'Visão geral' && <OverviewTab />}
        {tab === 'Backups' && <BackupsTab />}
        {tab === 'Limpeza' && <CleanupTab />}
      </section>
    </main>
  )
}
