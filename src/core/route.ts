/** Abas da Limpeza. */
export type CleanupTab = 'sem-uso' | 'duplicados' | 'quebrados' | 'pastas-vazias'

const TABS: readonly CleanupTab[] = ['sem-uso', 'duplicados', 'quebrados', 'pastas-vazias']

/** Vistas do painel. */
export type View =
  | { name: 'overview' }
  | { name: 'folder'; id: string }
  | { name: 'uncategorized' }
  | { name: 'cleanup'; tab?: CleanupTab }
  | { name: 'organize' }
  | { name: 'backups' }
  | { name: 'trash' }

const SIMPLE = {
  'sem-categoria': 'uncategorized',
  organizar: 'organize',
  backups: 'backups',
  lixeira: 'trash',
} as const

/** Endereço (`#/…`) de uma vista. A rota diz só a tela e a aba, nunca uma ação. */
export function formatRoute(view: View): string {
  switch (view.name) {
    case 'overview': return '#/'
    case 'cleanup': return view.tab ? `#/limpeza/${view.tab}` : '#/limpeza'
    case 'folder': return `#/pasta/${encodeURIComponent(view.id)}`
    case 'uncategorized': return '#/sem-categoria'
    case 'organize': return '#/organizar'
    case 'backups': return '#/backups'
    case 'trash': return '#/lixeira'
  }
}

/** Inverso de `formatRoute`. Endereço desconhecido ou malformado vira a Visão geral; parâmetros (`?…`) são ignorados. */
export function parseRoute(hash: string): View {
  const overview: View = { name: 'overview' }
  if (!hash.startsWith('#/')) return overview
  const parts = hash.slice(2).split('?')[0]!.split('/')
  const [head, arg, ...rest] = parts
  if (rest.length > 0) return overview
  if (head === 'limpeza') {
    if (arg === undefined) return { name: 'cleanup' }
    const tab = TABS.find((t) => t === arg)
    return tab ? { name: 'cleanup', tab } : { name: 'cleanup' }
  }
  if (head === 'pasta') {
    if (!arg) return overview
    try {
      return { name: 'folder', id: decodeURIComponent(arg) }
    } catch {
      return overview
    }
  }
  if (arg !== undefined) return overview
  const simple = SIMPLE[head as keyof typeof SIMPLE]
  return simple ? { name: simple } : overview
}
