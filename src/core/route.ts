/** Vistas do painel. */
export type View =
  | { name: 'overview' }
  | { name: 'folder'; id: string }
  | { name: 'cleanup'; start?: 'sem-uso' | 'duplicado' | 'quebrado' }
  | { name: 'backups' }
  | { name: 'trash' }
