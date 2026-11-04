import type { ProviderConfig } from '../storage/aiStore'
import { RESPONSE_SCHEMA } from './prompt'
import { ProviderError, type Provider } from './provider'

type CompatConfig = Extract<ProviderConfig, { kind: 'openai-compat' }>

const RETRIES = 2

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason) }, { once: true })
  })
}

/** Espera pedida pelo provedor (`retry-after`, em segundos) ou recuo de 1 s, 2 s. */
function waitMs(res: Response, attempt: number): number {
  const ra = Number(res.headers.get('retry-after'))
  return Number.isFinite(ra) && ra >= 0 ? ra * 1000 : 1000 * 2 ** attempt
}

/** Adaptador para APIs compatíveis com OpenAI (OpenAI, Gemini, Groq, OpenRouter, Ollama), via `fetch`. */
export function openaiCompatProvider(cfg: CompatConfig, fetchFn: typeof fetch = (...a) => fetch(...a)): Provider {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

  const post = async (body: unknown, signal: AbortSignal): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetchFn(url, { method: 'POST', headers, body: JSON.stringify(body), signal })
      } catch (e) {
        if (signal.aborted) throw e
        throw new ProviderError('network', e instanceof Error ? e.message : String(e))
      }
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= RETRIES) return res
      await sleep(waitMs(res, attempt), signal)
    }
  }

  const call = async (system: string, user: string, signal: AbortSignal): Promise<string> => {
    const base = { model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }
    let res = await post({ ...base, response_format: { type: 'json_schema', json_schema: { name: 'sugestoes', schema: RESPONSE_SCHEMA, strict: true } } }, signal)
    // Provedor que não aceita json_schema: tenta uma vez com json_object.
    if (res.status === 400) res = await post({ ...base, response_format: { type: 'json_object' } }, signal)
    if (res.status === 401 || res.status === 403) throw new ProviderError('auth', `HTTP ${res.status}`)
    if (res.status === 404) throw new ProviderError('model', `HTTP ${res.status}`)
    if (res.status === 429) throw new ProviderError('rate', `HTTP ${res.status}`)
    if (res.status >= 500) throw new ProviderError('overloaded', `HTTP ${res.status}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] }
    const choice = data.choices?.[0]
    if (choice?.finish_reason === 'content_filter') throw new ProviderError('refusal', 'Pedido recusado')
    const content = choice?.message?.content
    return typeof content === 'string' ? content : ''
  }

  return {
    classify: call,
    test: async (signal) => {
      await call('Responda só com {"itens": []}.', 'Teste de conexão.', signal)
    },
  }
}
