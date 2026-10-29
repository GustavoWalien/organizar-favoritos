const pad = (n: number) => String(n).padStart(2, '0')

export function backupFileName(createdAt: number, ext: 'json' | 'html'): string {
  const d = new Date(createdAt)
  return `favoritos-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`
}
