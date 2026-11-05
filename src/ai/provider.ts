import type { ProviderConfig } from '../storage/aiStore'
import { anthropicProvider } from './anthropic'
import { openaiCompatProvider } from './openaiCompat'

export type ProviderErrorKind = 'auth' | 'model' | 'rate' | 'overloaded' | 'network' | 'refusal'

export class ProviderError extends Error {
  constructor(public kind: ProviderErrorKind, message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Um provedor de IA: devolve o texto JSON da resposta, que quem chama valida. */
export interface Provider {
  /** `context` se repete entre os lotes (o adaptador Anthropic o põe no cache de prompt). */
  classify(system: string, context: string, user: string, signal: AbortSignal): Promise<string>
  /** Chamada mínima para conferir chave, modelo e acesso. */
  test(signal: AbortSignal): Promise<void>
}

export function makeProvider(cfg: ProviderConfig): Provider {
  return cfg.kind === 'anthropic' ? anthropicProvider(cfg) : openaiCompatProvider(cfg)
}

/** Problema na configuração antes de qualquer chamada (síncrono: pode rodar dentro do clique). */
export function configProblem(cfg: ProviderConfig): string | null {
  if (!cfg.model.trim()) return 'Informe o modelo.'
  if (cfg.kind === 'anthropic') return cfg.apiKey ? null : 'Informe a chave de API.'
  try {
    const u = new URL(cfg.baseUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
  } catch {
    return 'URL base inválida: use o endereço completo, como https://api.openai.com/v1.'
  }
  return null
}

/**
 * Chave para o rascunho: a digitada, ou a guardada só se for o mesmo tipo de provedor e, no compatível,
 * a mesma origem. Assim a chave de um provedor nunca vai para outro host.
 */
export function keyForDraft(kind: ProviderConfig['kind'], baseUrl: string, typed: string, saved: ProviderConfig | null): string {
  if (typed) return typed
  if (!saved || saved.kind !== kind) return ''
  if (saved.kind === 'anthropic') return saved.apiKey
  try {
    return new URL(baseUrl).origin === new URL(saved.baseUrl).origin ? saved.apiKey : ''
  } catch {
    return ''
  }
}

/** Origem para pedir a permissão de host: `https://host/*`. */
export function providerOrigin(cfg: ProviderConfig): string {
  if (cfg.kind === 'anthropic') return 'https://api.anthropic.com/*'
  return `${new URL(cfg.baseUrl).origin}/*`
}

/** Mensagem para a tela (seção 7 do design). Nunca contém a chave. */
export function errorMessage(e: unknown, cfg: ProviderConfig): string {
  const origin = providerOrigin(cfg).replace('/*', '')
  if (e instanceof ProviderError) {
    switch (e.kind) {
      case 'auth': return 'A chave foi recusada pelo provedor. Confira a chave e o plano da conta.'
      case 'model': return `O modelo '${cfg.model}' não existe nesse provedor.`
      case 'rate': return 'Limite de uso do provedor atingido. Tente de novo em alguns minutos.'
      case 'overloaded': return 'O provedor está sobrecarregado. Tente de novo em alguns minutos.'
      case 'network': return `Não foi possível falar com o provedor. A extensão tem permissão para acessar ${origin}?`
      case 'refusal': return 'O provedor recusou um lote.'
    }
  }
  const raw = e instanceof Error ? e.message : String(e)
  const safe = cfg.apiKey ? raw.split(cfg.apiKey).join('…') : raw
  return `Erro inesperado do provedor: ${safe}`
}
