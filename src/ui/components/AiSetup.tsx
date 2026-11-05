import { useMemo, useState } from 'react'
import { applyDomainRule } from '../../ai/domainRule'
import { estimateCost } from '../../ai/prompt'
import { buildScope, type AiScope, type ScopeKind } from '../../ai/scope'
import { folderOptions } from '../../core/folders'
import type { MarksMap } from '../../core/marks'
import type { BmNode } from '../../core/types'
import { keyForDraft } from '../../ai/provider'
import { maskKey, type ProviderConfig } from '../../storage/aiStore'
import type { AiSuggestionsState } from '../state/useAiSuggestions'

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (padrão)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (mais barato)' },
]
const fmt = (n: number) => n.toLocaleString('pt-BR')

interface Props {
  tree: BmNode[]
  marks: MarksMap
  ai: AiSuggestionsState
  /** Escopo inicial (ex.: vindo do passo "sem categoria"). */
  initialKind?: ScopeKind
}

/** Tela 5 do quadro: o que organizar, provedor e o que vai ser enviado. */
export default function AiSetup({ tree, marks, ai, initialKind = 'sem-categoria' }: Props) {
  const [kind, setKind] = useState<ScopeKind>(initialKind)
  const folders = useMemo(() => folderOptions(tree), [tree])
  const [folderId, setFolderId] = useState<string>(folders[0]?.id ?? '')
  const [allowNew, setAllowNew] = useState(true)

  const saved = ai.provider
  const [editing, setEditing] = useState(!saved)
  const [draftKind, setDraftKind] = useState<ProviderConfig['kind']>(saved?.kind ?? 'anthropic')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(saved?.model ?? 'claude-opus-5-5')
  const [baseUrl, setBaseUrl] = useState(saved?.kind === 'openai-compat' ? saved.baseUrl : 'https://api.openai.com/v1')
  const [testing, setTesting] = useState(false)

  const scope: AiScope = { kind, allowNew, ...(kind === 'pasta' ? { folderId } : {}) }
  const sc = useMemo(() => buildScope(tree, marks, scope), [tree, marks, kind, folderId, allowNew])
  const ruled = useMemo(() => applyDomainRule(tree, marks, sc, kind).length, [tree, marks, sc, kind])
  const toAi = sc.items.length - ruled
  const cost = estimateCost(saved?.model ?? model, toAi, sc.candidates.length)

  const draft = (): ProviderConfig => {
    const keyToUse = keyForDraft(draftKind, baseUrl, apiKey, saved)
    return draftKind === 'anthropic'
      ? { kind: 'anthropic', apiKey: keyToUse, model: MODELS.some((m) => m.id === model) ? model : 'claude-opus-5-5' }
      : { kind: 'openai-compat', baseUrl: baseUrl.trim(), apiKey: keyToUse, model: model.trim() }
  }
  const test = async () => {
    setTesting(true)
    try {
      if (await ai.testProvider(draft())) { setEditing(false); setApiKey('') }
    } finally {
      setTesting(false)
    }
  }

  const busy = ai.progress !== null
  const canGenerate = !!saved && !editing && sc.items.length > 0 && !busy

  return (
    <section className="ai">
      <div className="page-head">
        <div>
          <h1>Sugestões da IA</h1>
          <p className="muted">A IA propõe uma pasta para cada favorito. Nada muda até você revisar e aplicar, e tudo pode ser desfeito.</p>
        </div>
      </div>

      {ai.error && <p role="alert" className="import-error">{ai.error}</p>}

      <div className="dash-row two">
        <section className="panel ai-card">
          <h2 className="label-caps">1 · O que organizar</h2>
          <label className={`ai-opt${kind === 'sem-categoria' ? ' on' : ''}`}>
            <input type="radio" name="escopo" checked={kind === 'sem-categoria'} onChange={() => setKind('sem-categoria')} disabled={busy} />
            <span><b>Sem categoria</b><br /><span className="muted small">Os soltos nas pastas raiz ganham uma pasta, existente ou nova.</span></span>
          </label>
          <label className={`ai-opt${kind === 'pasta' ? ' on' : ''}`}>
            <input type="radio" name="escopo" checked={kind === 'pasta'} onChange={() => setKind('pasta')} disabled={busy} />
            <span><b>Dentro de uma pasta</b><br /><span className="muted small">Divide uma pasta grande em subpastas.</span>
              {kind === 'pasta' && (
                <select value={folderId} onChange={(e) => setFolderId(e.target.value)} aria-label="Pasta" disabled={busy}>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              )}
            </span>
          </label>
          <label className={`ai-opt${kind === 'todos' ? ' on' : ''}`}>
            <input type="radio" name="escopo" checked={kind === 'todos'} onChange={() => setKind('todos')} disabled={busy} />
            <span><b>Todos os favoritos</b><br /><span className="muted small">Propõe uma estrutura nova para tudo. Revisão mais longa.</span></span>
          </label>
          <label className="check-line"><input type="checkbox" checked={allowNew} onChange={(e) => setAllowNew(e.target.checked)} disabled={busy} /> Pode criar pastas novas</label>
          <p className="muted small">Ficam de fora: os marcados "não mexer" e a Lixeira.</p>
        </section>

        <section className="panel ai-card">
          <h2 className="label-caps">2 · Provedor</h2>
          {!editing && saved ? (
            <div className="ai-saved">
              <span>{saved.kind === 'anthropic' ? 'Anthropic' : `Compatível com OpenAI · ${new URL(saved.baseUrl).host}`} · {saved.model}{saved.apiKey ? ` · chave ${maskKey(saved.apiKey)}` : ''}</span>
              <button onClick={() => setEditing(true)} disabled={busy}>Trocar</button>
              <p className="ok-text small">Conectado · a chave fica só neste navegador</p>
            </div>
          ) : (
            <>
              <div className="segmented" role="radiogroup" aria-label="Provedor">
                <button role="radio" aria-checked={draftKind === 'anthropic'} onClick={() => { setDraftKind('anthropic'); setModel('claude-opus-5-5') }}>Anthropic</button>
                <button role="radio" aria-checked={draftKind === 'openai-compat'} onClick={() => { setDraftKind('openai-compat'); setModel('') }}>Compatível com OpenAI</button>
              </div>
              {draftKind === 'openai-compat' && (
                <label className="field">URL base<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" /></label>
              )}
              <label className="field">Chave de API{draftKind === 'openai-compat' ? ' (opcional no Ollama)' : ''}
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={keyForDraft(draftKind, baseUrl, '', saved) ? `guardada (${maskKey(saved!.apiKey)})` : 'cole a chave aqui'} autoComplete="off" />
              </label>
              <label className="field">Modelo
                {draftKind === 'anthropic' ? (
                  <select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                ) : (
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="ex.: gpt-5-mini, llama3.1" />
                )}
              </label>
              <div className="toolbar">
                <button className="primary" onClick={() => { void test() }} disabled={testing || !model}>{testing ? 'Testando…' : 'Testar conexão'}</button>
                {saved && <button onClick={() => setEditing(false)}>Cancelar</button>}
              </div>
              <p className="muted small">A chave fica só neste navegador. A assinatura do ChatGPT ou do Claude não serve: é preciso uma chave de API do console do provedor.</p>
            </>
          )}
        </section>
      </div>

      <section className="panel ai-send">
        <div className="ai-send-text">
          <h2 className="label-caps">3 · O que vai ser enviado</h2>
          {sc.items.length === 0 ? (
            <p>Nada para organizar neste escopo.</p>
          ) : (
            <p>
              {fmt(toAi)} {toAi === 1 ? 'favorito' : 'favoritos'}, só <b>título e domínio</b> (nunca o endereço completo), e os nomes de {fmt(sc.candidates.length)} pastas,
              para <b>{saved ? (saved.kind === 'anthropic' ? 'Anthropic' : new URL(saved.baseUrl).host) : 'o provedor'} · {saved?.model ?? model}</b>.
            </p>
          )}
          <p className="muted small">
            {cost.batches} {cost.batches === 1 ? 'lote' : 'lotes'} · {cost.usdMax === null ? 'custo depende do provedor' : `custo estimado abaixo de US$ ${cost.usdMax.toFixed(2).replace('.', ',')}`}, cobrado na sua conta do provedor.
            {ruled > 0 && ` ${fmt(ruled)} já têm pasta pela regra de domínio e não vão para a IA.`}
            {sc.skipped.notWeb > 0 && ` ${fmt(sc.skipped.notWeb)} não são sites (arquivos locais etc.) e ficam de fora.`}
            {sc.candidatesCut > 0 && ` Só as ${fmt(sc.candidates.length)} pastas mais rasas vão como opção.`}
          </p>
        </div>
        {busy ? (
          <div className="ai-progress" role="status">
            <progress value={ai.progress!.batch - 1} max={ai.progress!.batches} /> Lote {ai.progress!.batch} de {ai.progress!.batches}
            <button onClick={ai.cancel}>Cancelar</button>
          </div>
        ) : (
          <button className="primary big" onClick={() => { void ai.generate(scope) }} disabled={!canGenerate}>Gerar sugestões</button>
        )}
      </section>
    </section>
  )
}
