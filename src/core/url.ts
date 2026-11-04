const TRACKING = (name: string) => name.startsWith('utm_') || name === 'fbclid' || name === 'gclid'

/** Forma canônica para comparar URLs. Devolve null se não for uma URL http(s) válida. */
export function normalizeUrl(input: string): string | null {
  let u: URL
  try {
    u = new URL(input)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING(k.toLowerCase()))
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const search = params.length ? `?${new URLSearchParams(params).toString()}` : ''
  const path = u.pathname.replace(/\/+$/, '')
  return `${u.protocol}//${u.host}${path}${search}`
}

/**
 * Chave de um link no CSV da estrutura: `normalizeUrl` para http(s) e, para arquivos locais
 * (`file:`), a URL sem o `#fragmento`. Arquivos locais ficam de fora de `normalizeUrl` (duplicados,
 * sem uso), mas precisam ir e voltar no CSV. Outros esquemas (`javascript:`, `chrome:`…) dão null.
 */
export function structureUrlKey(input: string): string | null {
  const web = normalizeUrl(input)
  if (web !== null) return web
  let u: URL
  try {
    u = new URL(input)
  } catch {
    return null
  }
  if (u.protocol !== 'file:') return null
  u.hash = ''
  return u.href
}

function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.local') || host === '[::1]') return true
  if (!host.includes('.')) return true // intranet: nome sem ponto
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254)
}

/** Só sites http(s) públicos valem a pena testar. */
export function isCheckableUrl(input: string): boolean {
  let u: URL
  try {
    u = new URL(input)
  } catch {
    return false
  }
  return (u.protocol === 'http:' || u.protocol === 'https:') && !isPrivateHost(u.hostname)
}
