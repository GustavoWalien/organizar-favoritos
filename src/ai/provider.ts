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
  classify(system: string, user: string, signal: AbortSignal): Promise<string>
  /** Chamada mínima para conferir chave, modelo e acesso. */
  test(signal: AbortSignal): Promise<void>
}

export function makeProvider(cfg: ProviderConfig): Provider {
  return cfg.kind === 'anthropic' ? anthropicProvider(cfg) : openaiCompatProvider(cfg)
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
