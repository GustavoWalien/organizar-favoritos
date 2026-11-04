import Anthropic from '@anthropic-ai/sdk'
import type { ProviderConfig } from '../storage/aiStore'
import { RESPONSE_SCHEMA } from './prompt'
import { ProviderError, type Provider } from './provider'
import { InvalidResponseError } from './validate'

type AnthropicConfig = Extract<ProviderConfig, { kind: 'anthropic' }>

/** Converte erros do SDK para o tipo do provedor. */
function toProviderError(e: unknown): unknown {
  if (e instanceof ProviderError) return e
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new ProviderError('auth', e.message)
  if (e instanceof Anthropic.NotFoundError) return new ProviderError('model', e.message)
  if (e instanceof Anthropic.RateLimitError) return new ProviderError('rate', e.message)
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError('network', e.message)
  if (e instanceof Anthropic.APIError && typeof e.status === 'number' && e.status >= 500) return new ProviderError('overloaded', e.message)
  return e
}

/**
 * Adaptador Anthropic com o SDK oficial, rodando no navegador com a chave do próprio usuário.
 * Opus 5.5 não permite desligar o raciocínio: o esforço baixo é o controle de custo.
 */
export function anthropicProvider(cfg: AnthropicConfig, client?: Pick<Anthropic, 'beta'>): Provider {
  const api = client ?? new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 })

  const call = async (system: string, context: string, user: string, maxTokens: number, signal: AbortSignal): Promise<string> => {
    try {
      const res = await api.beta.messages.create(
        {
          model: cfg.model,
          max_tokens: maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          // Instruções e candidatas se repetem em todos os lotes: ficam antes do ponto de cache.
          system: [{ type: 'text', text: system }, { type: 'text', text: context, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: user }],
          output_config: { effort: 'low', format: { type: 'json_schema', schema: RESPONSE_SCHEMA as unknown as Record<string, unknown> } },
        },
        { signal },
      )
      if (res.stop_reason === 'refusal') throw new ProviderError('refusal', 'Pedido recusado')
      // Resposta cortada: o JSON não fecha. Trata como resposta inválida (o lote é refeito uma vez).
      if (res.stop_reason === 'max_tokens') throw new InvalidResponseError('Resposta cortada pelo limite de tokens')
      const text = res.content.find((b) => b.type === 'text')
      return text && text.type === 'text' ? text.text : ''
    } catch (e) {
      throw toProviderError(e)
    }
  }

  return {
    // 16.000: o raciocínio do Opus 5.5 conta no limite, junto com cerca de 40 tokens por favorito.
    classify: (system, context, user, signal) => call(system, context, user, 16000, signal),
    test: async (signal) => {
      await call('Responda só com JSON: {"itens": []}.', 'Sem candidatas.', 'Teste de conexão.', 1000, signal)
    },
  }
}
