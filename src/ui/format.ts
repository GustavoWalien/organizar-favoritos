/** Domínio para mostrar na lista (sem "www."). Texto que não é URL web volta como veio. */
export function domainOf(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url
    return u.host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const DAY_MS = 86_400_000

/** "hoje", "ontem", "há 5 dias", "há 3 meses", "há 2 anos" ou "sem registro". */
export function lastUsedLabel(dateLastUsed: number | undefined, now: number): string {
  if (!dateLastUsed || dateLastUsed <= 0) return 'sem registro'
  const days = Math.floor((now - dateLastUsed) / DAY_MS)
  if (days < 1) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
  }
  const years = Math.floor(days / 365)
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}
