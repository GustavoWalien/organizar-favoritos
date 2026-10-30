/** Vistas do painel. */
export type View =
  | { name: 'overview' }
  | { name: 'folder'; id: string }
  | { name: 'uncategorized' }
  | { name: 'cleanup'; start?: 'sem-uso' | 'duplicado' | 'quebrado' }
  | { name: 'organize' }
  | { name: 'backups' }
  | { name: 'trash' }
