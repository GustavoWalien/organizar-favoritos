import type { AiScope } from '../ai/scope'
import type { Confidence, Suggestion } from '../ai/validate'
import { chromeLocalStore, type KeyValueStore } from '../chrome/localStore'

export type ProviderConfig =
  | { kind: 'anthropic'; apiKey: string; model: string }
  | { kind: 'openai-compat'; baseUrl: string; apiKey: string; model: string }

export interface ProposalItem extends Suggestion {
  title: string
  domain: string
  fromFolderId: string
  source: 'ia' | 'regra'
  accepted: boolean
}

export interface Proposal {
  createdAt: number
  provider: ProviderConfig['kind']
  model: string
  scope: AiScope
  items: ProposalItem[]
  failedBatches: number
  /** Itens que ficaram sem sugestão. */
  missing: number
}

const PROVIDER_KEY = 'aiProvider'
const PROPOSAL_KEY = 'aiProposal'
const CONF: readonly Confidence[] = ['alta', 'media', 'baixa']

async function read(store: KeyValueStore, key: string): Promise<unknown> {
  try {
    return await store.get(key)
  } catch {
    return undefined
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function parseProvider(v: unknown): ProviderConfig | null {
  if (!isObj(v) || !isStr(v.model) || v.model.trim() === '' || !isStr(v.apiKey)) return null
  if (v.kind === 'anthropic') return { kind: 'anthropic', apiKey: v.apiKey, model: v.model }
  if (v.kind === 'openai-compat' && isStr(v.baseUrl) && isHttpUrl(v.baseUrl)) {
    return { kind: 'openai-compat', baseUrl: v.baseUrl, apiKey: v.apiKey, model: v.model }
  }
  return null
}

function parseItem(v: unknown): ProposalItem | null {
  if (!isObj(v)) return null
  const conf = CONF.find((c) => c === v.confidence)
  if (!isStr(v.itemId) || !isStr(v.folderId) || !conf || !Array.isArray(v.newPath) || !v.newPath.every(isStr)) return null
  if (!isStr(v.title) || !isStr(v.domain) || !isStr(v.fromFolderId) || !isStr(v.reason)) return null
  if (v.source !== 'ia' && v.source !== 'regra') return null
  if (typeof v.accepted !== 'boolean') return null
  return {
    itemId: v.itemId, folderId: v.folderId, newPath: v.newPath, confidence: conf, reason: v.reason,
    title: v.title, domain: v.domain, fromFolderId: v.fromFolderId, source: v.source, accepted: v.accepted,
  }
}

function parseProposal(v: unknown): Proposal | null {
  if (!isObj(v) || !isNum(v.createdAt) || !isStr(v.model) || !Array.isArray(v.items)) return null
  if (v.provider !== 'anthropic' && v.provider !== 'openai-compat') return null
  const s = v.scope
  if (!isObj(s) || !['sem-categoria', 'pasta', 'todos'].includes(s.kind as string) || typeof s.allowNew !== 'boolean') return null
  const items = v.items.map(parseItem)
  if (items.some((i) => i === null)) return null
  return {
    createdAt: v.createdAt, provider: v.provider, model: v.model,
    scope: { kind: s.kind as AiScope['kind'], allowNew: s.allowNew, ...(isStr(s.folderId) ? { folderId: s.folderId } : {}) },
    items: items as ProposalItem[],
    failedBatches: isNum(v.failedBatches) ? v.failedBatches : 0,
    missing: isNum(v.missing) ? v.missing : 0,
  }
}

export async function loadProvider(store: KeyValueStore = chromeLocalStore): Promise<ProviderConfig | null> {
  return parseProvider(await read(store, PROVIDER_KEY))
}

export async function saveProvider(cfg: ProviderConfig, store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set(PROVIDER_KEY, cfg)
}

/** Esquece o provedor e a chave: o valor guardado é sobrescrito. */
export async function clearProvider(store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set(PROVIDER_KEY, null)
}

export async function loadProposal(store: KeyValueStore = chromeLocalStore): Promise<Proposal | null> {
  return parseProposal(await read(store, PROPOSAL_KEY))
}

export async function saveProposal(p: Proposal, store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set(PROPOSAL_KEY, p)
}

export async function clearProposal(store: KeyValueStore = chromeLocalStore): Promise<void> {
  await store.set(PROPOSAL_KEY, null)
}

/** Chave para mostrar na tela: só os 4 últimos caracteres (nada, se a chave for curta). */
export function maskKey(key: string): string {
  if (key === '') return ''
  return key.length < 8 ? '…' : `…${key.slice(-4)}`
}
