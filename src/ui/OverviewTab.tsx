import { useEffect, useState } from 'react'
import { chromeBookmarksApi } from '../chrome/bookmarksApi'
import { summarize, type TreeSummary } from '../core/tree'

export default function OverviewTab() {
  const [summary, setSummary] = useState<TreeSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    chromeBookmarksApi.getTree().then((tree) => setSummary(summarize(tree)), (e) => setError(String(e)))
  }, [])

  if (error) return <p role="alert">Não foi possível ler os favoritos: {error}</p>
  if (!summary) return <p>Lendo favoritos…</p>

  const pct = summary.links ? Math.round((summary.withLastUsed / summary.links) * 100) : 0
  return (
    <dl>
      <dt>Favoritos</dt><dd>{summary.links}</dd>
      <dt>Pastas</dt><dd>{summary.folders}</dd>
      <dt>Com data de último uso</dt><dd>{summary.withLastUsed} ({pct}%)</dd>
    </dl>
  )
}
