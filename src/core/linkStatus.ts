import { isCheckableUrl } from './url'

export type LinkStatus = 'ok' | 'quebrado' | 'incerto'

/** Só 404 e 410 provam que o link morreu; todo o resto que não seja sucesso é dúvida. */
export function classifyStatus(httpStatus: number): LinkStatus {
  if (httpStatus === 404 || httpStatus === 410) return 'quebrado'
  if (httpStatus >= 200 && httpStatus <= 399) return 'ok'
  return 'incerto'
}

export interface CheckOptions {
  concurrency?: number
  timeoutMs?: number
  fetchFn?: typeof fetch
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

async function request(url: string, method: 'HEAD' | 'GET', timeoutMs: number, fetchFn: typeof fetch, outer?: AbortSignal): Promise<number | null> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const onOuterAbort = () => ctl.abort()
  outer?.addEventListener('abort', onOuterAbort)
  try {
    const res = await fetchFn(url, { method, redirect: 'follow', credentials: 'omit', cache: 'no-store', signal: ctl.signal })
    void res.body?.cancel().catch(() => {})
    return res.status
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', onOuterAbort)
  }
}

async function checkOne(url: string, timeoutMs: number, fetchFn: typeof fetch, signal?: AbortSignal): Promise<LinkStatus> {
  const head = await request(url, 'HEAD', timeoutMs, fetchFn, signal)
  if (head !== null && classifyStatus(head) === 'ok') return 'ok'
  // Muitos servidores respondem errado ao HEAD; o GET decide.
  const get = await request(url, 'GET', timeoutMs, fetchFn, signal)
  return get === null ? 'incerto' : classifyStatus(get)
}

/** Testa os links com concorrência limitada. URLs não verificáveis ficam fora do resultado. */
export async function checkLinks(urls: string[], opts: CheckOptions = {}): Promise<Map<string, LinkStatus>> {
  const { concurrency = 10, timeoutMs = 10_000, fetchFn = fetch, onProgress, signal } = opts
  const queue = [...new Set(urls)].filter(isCheckableUrl)
  const results = new Map<string, LinkStatus>()
  const total = queue.length
  let next = 0
  let done = 0

  const worker = async () => {
    while (!signal?.aborted && next < total) {
      const url = queue[next++]!
      const status = await checkOne(url, timeoutMs, fetchFn, signal)
      if (signal?.aborted) return // resposta cortada pelo cancelamento: não conta
      results.set(url, status)
      onProgress?.(++done, total)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, worker))
  return results
}
