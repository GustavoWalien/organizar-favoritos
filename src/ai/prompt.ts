import type { AiScope, Candidate, ScopeItem } from './scope'

export const BATCH_SIZE = 100
const MAX_TITLE = 200

/** Instruções fixas (seção 5.3 do design). Iguais em todos os lotes, para o cache de prompt. */
export const SYSTEM_PROMPT = [
  'Você organiza favoritos do navegador em pastas.',
  'Para cada favorito (título "t" e domínio "d"), escolha a pasta mais adequada entre as candidatas numeradas.',
  'Regras:',
  '- Prefira uma pasta existente sempre que ela servir.',
  '- Crie pasta nova só quando um grupo de favoritos justificar, com nomes curtos em português, no máximo 2 níveis abaixo da candidata escolhida (separe os níveis com " / ").',
  '- Uma candidata marcada como (raiz) só pode ser usada com pasta nova abaixo dela.',
  '- "pasta" é o número da candidata; "nova" é vazio para mover direto para ela, ou o subcaminho a criar abaixo dela.',
  '- "motivo" tem no máximo 6 palavras.',
  '- "confianca" é "alta", "media" ou "baixa"; use "baixa" quando o título for vago ou genérico.',
  '- Responda um item para cada favorito, usando o mesmo "i".',
].join('\n')

export interface BatchItem { i: number; t: string; d: string }
export interface Batch {
  items: BatchItem[]
  /** `ids[i]` = id do Chrome do item `i`. Nunca sai do navegador. */
  ids: string[]
}

export function makeBatches(items: ScopeItem[], size = BATCH_SIZE): Batch[] {
  const out: Batch[] = []
  for (let s = 0; s < items.length; s += size) {
    const chunk = items.slice(s, s + size)
    out.push({
      items: chunk.map((it, i) => ({ i, t: it.title.slice(0, MAX_TITLE), d: it.domain })),
      ids: chunk.map((it) => it.id),
    })
  }
  return out
}

/** Mensagem do usuário de um lote: candidatas numeradas, regra de pastas novas e os itens em JSON. */
export function userPrompt(candidates: Candidate[], batch: Batch, scope: AiScope): string {
  const lines = candidates.map((c) => `${c.k}: ${c.label}${c.isRoot ? ' (raiz)' : ''}`)
  const rule = scope.allowNew
    ? 'Você pode criar pastas novas (até 2 níveis abaixo de uma candidata).'
    : 'Não crie pastas novas: use só as candidatas que não são raiz, e deixe "nova" vazio.'
  return [
    'Pastas candidatas:',
    ...lines,
    '',
    rule,
    '',
    'Favoritos:',
    JSON.stringify(batch.items),
  ].join('\n')
}

/** Esquema da resposta (seção 6.2 do design). */
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          pasta: { type: 'integer' },
          nova: { type: 'string' },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          motivo: { type: 'string' },
        },
        required: ['i', 'pasta', 'nova', 'confianca', 'motivo'],
        additionalProperties: false,
      },
    },
  },
  required: ['itens'],
  additionalProperties: false,
} as const

/** Preço por milhão de tokens (entrada, saída), tabela de 2026-10-06. */
export const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
}

/** Estimativa grosseira (seção 6.4 do design), arredondada para cima em centavos. `null` = preço desconhecido. */
export function estimateCost(model: string, nItems: number, nCandidates: number): { batches: number; usdMax: number | null } {
  const batches = Math.ceil(nItems / BATCH_SIZE)
  if (batches === 0) return { batches: 0, usdMax: 0 }
  const price = PRICES[model]
  if (!price) return { batches, usdMax: null }
  const input = batches * (1500 + 12 * nCandidates) + 25 * nItems
  const output = 40 * nItems + 2000 * batches
  const usd = (input * price[0] + output * price[1]) / 1_000_000
  return { batches, usdMax: Math.ceil(usd * 100) / 100 }
}
