import type { LinkStatus } from './linkStatus'
import { normalizeUrl } from './url'

/** Resultado guardado do último teste de links. `results` usa o endereço normalizado como chave. */
export interface LinkCheckRecord {
  checkedAt: number
  /** `false` quando o teste foi cancelado no meio. */
  complete: boolean
  results: Record<string, LinkStatus>
}

function normalized(statuses: Map<string, LinkStatus>): Record<string, LinkStatus> {
  const out: Record<string, LinkStatus> = {}
  for (const [url, status] of statuses) {
    const key = normalizeUrl(url)
    if (key !== null) out[key] = status
  }
  return out
}

/**
 * Novo registro a partir de um teste. Completo substitui o anterior; cancelado mescla sobre ele (o novo
 * vale mais). Nos dois casos `checkedAt` é `now`.
 */
export function recordLinkCheck(prev: LinkCheckRecord | null, statuses: Map<string, LinkStatus>, complete: boolean, now: number): LinkCheckRecord {
  const fresh = normalized(statuses)
  const results = complete || !prev ? fresh : { ...prev.results, ...fresh }
  return { checkedAt: now, complete, results }
}

/** Status de um endereço no registro, ou undefined se não foi testado. */
export function statusOf(rec: LinkCheckRecord | null, url: string): LinkStatus | undefined {
  const key = normalizeUrl(url)
  return rec && key !== null ? rec.results[key] : undefined
}
