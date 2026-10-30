const pad = (n: number) => String(n).padStart(2, '0')

/** `AAAA-MM-DD-HHMM` na hora local. */
const stamp = (t: number): string => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function backupFileName(createdAt: number, ext: 'json' | 'html'): string {
  return `favoritos-${stamp(createdAt)}.${ext}`
}

export function structureFileName(now: number): string {
  return `favoritos-estrutura-${stamp(now)}.csv`
}
