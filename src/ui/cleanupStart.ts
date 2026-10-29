export type CleanupStart = 'sem-uso' | 'duplicado' | 'quebrado'

/** Qual análise a vista de Limpeza roda sozinha ao abrir, a partir do cartão clicado na Visão geral. */
export function startAnalysis(start: CleanupStart | undefined): 'inactive' | 'dups' | 'links-manual' | null {
  if (start === 'sem-uso') return 'inactive'
  if (start === 'duplicado') return 'dups'
  if (start === 'quebrado') return 'links-manual'
  return null
}
