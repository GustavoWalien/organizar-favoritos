# Sugestões de pastas com IA — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a tela `#/ia` gera, com a API da Anthropic ou de um provedor compatível com OpenAI, uma proposta de pasta por favorito. O usuário revisa a proposta e aplica pelo `runPlan`.

**Architecture:** toda a lógica fica em funções puras em `src/ai/`:
- escopo e candidatas;
- regra de domínio;
- montagem do pedido;
- validação da resposta;
- montagem do plano.

Os adaptadores de provedor ficam atrás de uma interface única e são testados com cliente ou `fetch` falsos. Um hook (`useAiSuggestions`) orquestra os lotes e guarda a proposta em `chrome.storage.local`. As telas só desenham.

**Tech Stack:** React 19, TypeScript, WXT (MV3), Vitest, `@anthropic-ai/sdk` (dependência nova, só no adaptador Anthropic).

**Spec:** [`docs/superpowers/specs/2026-11-04-ia-sugestoes-design.md`](../specs/2026-11-04-ia-sugestoes-design.md). Quadro: https://claude.ai/artifact/2hrh5cvsUFPDNAZhbY7ChL (telas 5 e 6).

## Global Constraints

- **Única dependência nova:** `@anthropic-ai/sdk`. O adaptador compatível com OpenAI usa `fetch`. Nada de biblioteca de esquema (zod etc.): a validação é escrita à mão.
- **O que sai do navegador:** só título (cortado em 200 caracteres), domínio e nomes de pastas candidatas. Nunca a URL completa, o id do Chrome ou a chave em logs ou mensagens.
- **Chave:** fica em `chrome.storage.local`, na chave `aiProvider`. Na tela, aparece mascarada (`…` mais os 4 últimos caracteres).
- **Permissão de host:** pedida no clique de "Testar conexão", só para a origem do provedor (`https://api.anthropic.com/*` ou `new URL(base).origin + '/*'`).
- **Modelo padrão:** `claude-opus-5-5`. Também podem ser escolhidos `claude-sonnet-5-5` e `claude-haiku-5-5`.
- **Anthropic:**
  - `output_config: { effort: 'low', format: { type: 'json_schema', schema } }`;
  - `max_tokens: 8000`;
  - `fallbacks: 'default'` com a beta `server-side-fallback-2026-07-01` (`client.beta.messages.create`);
  - `dangerouslyAllowBrowser: true`;
  - cache de prompt no sistema.
- **Lotes:** até 100 itens, um de cada vez.
- **Pasta nova:** até 2 níveis abaixo da candidata; cada nome com no máximo 60 caracteres; o motivo com no máximo 60 caracteres.
- **Regra de domínio:** só no escopo "Sem categoria"; vale com pelo menos 2 favoritos do mesmo domínio e pelo menos 60% deles na mesma pasta.
- **Mudanças nos favoritos:** só por `runPlan(plan, api, now, store, { shareBackup: false })`.
- Interface em pt-BR, temas claro, escuro e sistema, ícones de `Icon`.
- Depois de cada tarefa: `npm test` verde, `npm run compile` limpo e `npm run build` ok.

## Review Focus

1. **Resposta da IA com lixo:** JSON truncado (`max_tokens`), item com `i` repetido, `pasta` que não existe, `nova` com `"../"` ou só espaços. Deve virar "sem sugestão" sem quebrar o lote. O teste fica na Task 3.
2. **Árvore mudou entre gerar e aplicar:** item ou pasta de destino apagados, item movido à mão, "não mexer" aplicado depois. Esses itens ficam de fora, contados, sem erro. O teste fica na Task 5.
3. **Duas sugestões criando a mesma pasta nova** em lotes diferentes, ou com maiúsculas e acentos diferentes ("Finanças" e "financas"). Deve sair uma pasta só no plano. O teste fica na Task 5.
4. **`chrome.storage.local` com `aiProposal` ou `aiProvider` antigos ou corrompidos.** Deve virar "sem proposta" ou "sem provedor". O teste fica na Task 4.
5. **Provedor compatível que rejeita `response_format: json_schema` (400).** Deve tentar de novo com `json_object` uma vez. O teste fica na Task 6.

---

### Task 1: Escopo e pastas candidatas

**Files:**
- Create: `src/ai/scope.ts`
- Test: `tests/ai/scope.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ScopeKind = 'sem-categoria' | 'pasta' | 'todos'
  export interface AiScope { kind: ScopeKind; folderId?: string; allowNew: boolean }
  export interface Candidate { k: number; folderId: string; label: string; segments: string[]; isRoot: boolean }
  export interface ScopeItem { id: string; title: string; url: string; domain: string; fromFolderId: string }
  export interface ScopeResult { items: ScopeItem[]; candidates: Candidate[]; skipped: { protected: number; notWeb: number }; candidatesCut: number }
  export function buildScope(tree: BmNode[], marks: MarksMap, scope: AiScope): ScopeResult
  export function domainKey(url: string): string | null   // host minúsculo sem "www."; null se não http(s)
  ```
  O `label` usa o formato `"Barra › Developer › Tools Dev"`. O primeiro segmento é o token `Barra`, `Outros` ou `Mobile` (vem de `rootToken`), não o título do Chrome.

- [ ] **Step 1: Testes**, com uma árvore com Barra (Dev › Tools, link solto `s1`), Outros (Lixeira com 1 link, pasta `Prot` marcada "não mexer" com 1 link) e Mobile vazio:
  - `sem-categoria`:
    - `items` são só os links soltos das raízes, sem os protegidos;
    - as candidatas incluem Barra e Outros (`isRoot: true`), Dev e Dev › Tools, e **não** incluem Lixeira, `Prot`, Mobile nem pastas dentro de `Prot`;
    - `k` vai de 0 a n-1, na ordem da árvore.
  - `pasta` com `folderId: Dev`: os itens são os links da subárvore de Dev; as candidatas são Dev e Tools (sem raízes).
  - `todos`: todos os links fora da Lixeira e sem proteção.
  - Um link `file:///x.pdf` e um `javascript:` contam em `skipped.notWeb` e não entram. Os protegidos contam em `skipped.protected`.
  - `domainKey('https://WWW.Exemplo.com/a')` devolve `'exemplo.com'`, e `domainKey('file:///x')` devolve `null`.
  - Com mais de 1.500 candidatas, ficam as 1.500 mais rasas (menos segmentos; empate pela ordem da árvore), e `ScopeResult` ganha `candidatesCut: number`. Testar com uma árvore gerada de 1.600 pastas.
- [ ] **Step 2:** `npx vitest run tests/ai/scope.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar. Usar `isProtectedEffective`, `findTrash`, `rootToken` e `normalizeUrl`/`URL`.
- [ ] **Step 4:** Rodar de novo. Esperado: PASS.
- [ ] **Step 5: Commit** `feat: escopo e pastas candidatas da IA`.

### Task 2: Regra de domínio e montagem dos lotes

**Files:**
- Create: `src/ai/domainRule.ts`, `src/ai/prompt.ts`
- Test: `tests/ai/domainRule.test.ts`, `tests/ai/prompt.test.ts`

**Interfaces:**
- Consumes: `ScopeResult`, `Candidate`, `ScopeItem`, `domainKey` (Task 1).
- Produces:
  ```ts
  // domainRule.ts
  export interface RuleHit { itemId: string; folderId: string }
  export function applyDomainRule(tree: BmNode[], marks: MarksMap, scope: ScopeResult): RuleHit[]
  // prompt.ts
  export const BATCH_SIZE = 100
  export const SYSTEM_PROMPT: string                       // texto fixo da seção 5.3 do design
  export interface BatchItem { i: number; t: string; d: string }
  export interface Batch { items: BatchItem[]; ids: string[] } // ids[i] = id do Chrome do item i
  export function makeBatches(items: ScopeItem[], size?: number): Batch[]
  export function userPrompt(candidates: Candidate[], batch: Batch, scope: AiScope): string
  export const RESPONSE_SCHEMA: object                     // seção 6.2 do design, com pasta: integer e nova: string
  export function estimateCost(model: string, nItems: number, nCandidates: number): { batches: number; usdMax: number | null }
  ```

- [ ] **Step 1: Testes de `applyDomainRule`:**
  - 3 favoritos de `github.com` em `Dev › Tools` mais um solto de `github.com`: o solto vai para Tools;
  - 1 só favorito do domínio numa pasta: nenhuma regra;
  - 2 em Tools e 2 em outra pasta (50%): nenhuma regra;
  - favoritos de pasta protegida não contam;
  - fora do escopo `sem-categoria`, devolve `[]`.
- [ ] **Step 2: Testes de `prompt.ts`:**
  - `makeBatches` com 250 itens dá lotes de 100, 100 e 50, com `i` de 0 a 99 em cada um;
  - os títulos com mais de 200 caracteres são cortados;
  - `userPrompt` contém as linhas `"0: Barra"`, `"2: Barra › Dev › Tools"`, a lista JSON dos itens e a frase de pasta nova permitida ou proibida, e **não contém** nenhuma URL nem id do Chrome (verificar com uma URL distinta no teste);
  - `estimateCost('claude-opus-5-5', 71, 80)` dá `batches: 1` e `usdMax > 0`; `estimateCost('gpt-x', 10, 5).usdMax` é `null`.

  A tabela de preços em `prompt.ts` é, por milhão de tokens de entrada e saída: Opus 5.5, 4 e 20; Sonnet 5.5, 2 e 10; Haiku 5.5, 0,10 e 0,50. A fórmula: entrada = 1.500 + 12 × candidatas + 25 × itens; saída = 40 × itens + 2.000 por lote. O resultado é arredondado para cima em centavos.
- [ ] **Step 3:** FAIL. **Step 4:** Implementar. **Step 5:** PASS.
- [ ] **Step 6: Commit** `feat: regra de domínio e montagem dos pedidos da IA`.

### Task 3: Validação da resposta

**Files:**
- Create: `src/ai/validate.ts`
- Test: `tests/ai/validate.test.ts`

**Interfaces:**
- Consumes: `Batch`, `Candidate` (Tasks 1 e 2).
- Produces:
  ```ts
  export type Confidence = 'alta' | 'media' | 'baixa'
  export interface Suggestion { itemId: string; folderId: string; newPath: string[]; confidence: Confidence; reason: string }
  export interface Validated { suggestions: Suggestion[]; missing: string[] }   // missing = ids do lote sem sugestão
  export class InvalidResponseError extends Error {}
  /** Lança InvalidResponseError se o texto não for JSON no formato; o resto vira "sem sugestão". */
  export function validateResponse(text: string, batch: Batch, candidates: Candidate[], allowNew: boolean, tree: BmNode[]): Validated
  ```

- [ ] **Step 1: Testes:**
  - texto não JSON, JSON sem `itens` e JSON truncado lançam `InvalidResponseError`;
  - **Review Focus 1:**
    - `i` repetido: vale o primeiro;
    - `i` fora do lote: ignorado;
    - `pasta` fora das candidatas: o item vai para `missing`;
    - `nova: "  "`: tratado como vazio;
    - `nova: "a / b / c"`: corta em `['a','b']`;
    - `nova: "../x"`: o nome fica `'../x'` como texto, sem ser interpretado como caminho, porque o separador é só `" / "`;
  - candidata raiz sem `nova`: o item vai para `missing`;
  - `nova: "tools"` abaixo de Dev, onde já existe `Tools`: resolve para `folderId` de Tools com `newPath: []`, sem diferenciar maiúsculas nem acentos;
  - `allowNew: false` com `nova` que não resolve: o item vai para `missing`;
  - `confianca: "talvez"` vira `'baixa'`; `motivo` com 100 caracteres é cortado em 60;
  - os itens do lote que não vieram na resposta entram em `missing`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. Para comparar nomes, usar `normalizeText`. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: validação da resposta da IA`.

### Task 4: Configuração do provedor e proposta guardada

**Files:**
- Create: `src/storage/aiStore.ts`
- Test: `tests/storage/aiStore.test.ts`

**Interfaces:**
- Consumes: `KeyValueStore`, `chromeLocalStore` (`src/chrome/localStore.ts`), `Suggestion`, `AiScope`.
- Produces:
  ```ts
  export type ProviderConfig =
    | { kind: 'anthropic'; apiKey: string; model: string }
    | { kind: 'openai-compat'; baseUrl: string; apiKey: string; model: string }
  export interface ProposalItem extends Suggestion { title: string; domain: string; fromFolderId: string; source: 'ia' | 'regra'; accepted: boolean }
  export interface Proposal { createdAt: number; provider: ProviderConfig['kind']; model: string; scope: AiScope; items: ProposalItem[]; failedBatches: number; missing: number }
  export function loadProvider(store?): Promise<ProviderConfig | null>
  export function saveProvider(cfg: ProviderConfig, store?): Promise<void>
  export function loadProposal(store?): Promise<Proposal | null>
  export function saveProposal(p: Proposal, store?): Promise<void>
  export function clearProposal(store?): Promise<void>
  export function maskKey(key: string): string   // '' → ''; 'sk-ant-abcd1234' → '…1234'
  ```

- [ ] **Step 1: Testes**, com um `KeyValueStore` em memória, no padrão de `tests/storage/prefs.test.ts`:
  - ida e volta das duas chaves;
  - **Review Focus 4:**
    - `aiProvider` com `kind` desconhecido, sem `model` ou com `baseUrl` não `http(s)` vira `null`;
    - `aiProposal` sem `items`, com um item sem `folderId` ou com `confidence` desconhecida vira `null`;
    - um armazenamento que lança erro devolve `null`;
  - `maskKey`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: guardar provedor e proposta da IA`.

### Task 5: Plano a partir da proposta

**Files:**
- Create: `src/ai/applyPlan.ts`
- Test: `tests/ai/applyPlan.test.ts`

**Interfaces:**
- Consumes: `Proposal`, `ProposalItem` (Task 4), `Plan`/`Operation` (`src/core/types.ts`), `isProtectedEffective`.
- Produces:
  ```ts
  export interface ProposalPlan { plan: Plan; moves: number; newFolders: number; changed: number }
  /** Só itens aceitos; relê a árvore e as marcas de agora. */
  export function planFromProposal(p: Proposal, tree: BmNode[], marks: MarksMap, now: number): ProposalPlan
  export function newFolderKey(folderId: string, newPath: string[]): string   // folderId + nomes normalizados (normalizeText)
  export function renameNewFolder(p: Proposal, folderId: string, oldPath: string[], newName: string, tree: BmNode[]): Proposal
  export function groupByTarget(p: Proposal, tree: BmNode[]): { key: string; folderId: string; newPath: string[]; label: string; isNew: boolean; items: ProposalItem[] }[]
  ```
  O rótulo do plano é `"Sugestões da IA: N favoritos"`.

- [ ] **Step 1: Testes:**
  - um item aceito para pasta existente gera `move`; um recusado não gera nada;
  - um item que já está no destino não gera operação e não conta em `moves`;
  - pasta nova de 2 níveis: dois `create-folder`, o pai antes do filho (o filho com `parentId` = `tempId` do pai), e o `move` para o `tempId` do filho;
  - **Review Focus 3:** dois itens com `newPath` `['Finanças']` e `['financas']` abaixo da mesma pasta geram **um** `create-folder` (com o nome do primeiro);
  - **Review Focus 2:** contam em `changed` e não geram operação os itens que:
    - foram apagados;
    - foram movidos à mão para outra pasta;
    - ganharam "não mexer" (próprio ou da pasta);
    - têm como destino uma pasta existente apagada ou que ganhou "não mexer";
  - `renameNewFolder` troca o último nome em todos os itens daquele grupo. Se o nome novo coincidir com uma pasta irmã existente, o grupo passa a apontar para ela (`newPath` encurta), e `groupByTarget` a mostra com `isNew: false`;
  - `groupByTarget` ordena pelo rótulo e marca `isNew` corretamente.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: plano de pastas e movimentos a partir da proposta`.

### Task 6: Adaptadores de provedor

**Files:**
- Modify: `package.json` (`npm i @anthropic-ai/sdk`)
- Create: `src/ai/provider.ts`, `src/ai/anthropic.ts`, `src/ai/openaiCompat.ts`
- Modify: `src/chrome/permissions.ts` (acrescentar `requestOriginPermission(origin: string): Promise<boolean>`)
- Test: `tests/ai/anthropic.test.ts`, `tests/ai/openaiCompat.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `RESPONSE_SCHEMA`, `userPrompt` (Task 2), `ProviderConfig` (Task 4).
- Produces:
  ```ts
  // provider.ts
  export type ProviderErrorKind = 'auth' | 'model' | 'rate' | 'overloaded' | 'network' | 'refusal'
  export class ProviderError extends Error { constructor(public kind: ProviderErrorKind, message: string) }
  export interface Provider {
    /** Devolve o texto JSON da resposta; quem chama valida. */
    classify(system: string, user: string, signal: AbortSignal): Promise<string>
    test(signal: AbortSignal): Promise<void>
  }
  export function makeProvider(cfg: ProviderConfig): Provider
  export function providerOrigin(cfg: ProviderConfig): string
  export function errorMessage(e: unknown, cfg: ProviderConfig): string   // mensagens da seção 7 do design, sem a chave
  // anthropic.ts
  export function anthropicProvider(cfg: Extract<ProviderConfig, { kind: 'anthropic' }>, client?: Pick<Anthropic, 'beta'>): Provider
  // openaiCompat.ts
  export function openaiCompatProvider(cfg: Extract<ProviderConfig, { kind: 'openai-compat' }>, fetchFn?: typeof fetch): Provider
  ```

- [ ] **Step 1: Testes da Anthropic**, com um cliente falso que grava o pedido:
  - o pedido tem `model` = `cfg.model`, `max_tokens: 8000`, `output_config.effort: 'low'`, `output_config.format.type: 'json_schema'`, `fallbacks: 'default'`, `betas` com `'server-side-fallback-2026-07-01'` e `system` com `cache_control`;
  - devolve o texto do primeiro bloco `text`;
  - `stop_reason: 'refusal'` gera `ProviderError('refusal')`;
  - `Anthropic.AuthenticationError` gera `'auth'`; `RateLimitError` gera `'rate'`; `NotFoundError` gera `'model'`; erro com status 529 gera `'overloaded'`.

  Construir os erros pelas classes do SDK. O cliente real é criado com `{ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 }`.
- [ ] **Step 2: Testes do compatível**, com um `fetch` falso:
  - `POST <baseUrl>/chat/completions` com `Authorization: Bearer <chave>` (sem o cabeçalho quando a chave é vazia), `response_format.type: 'json_schema'` e `strict: true`;
  - devolve `choices[0].message.content`;
  - **Review Focus 5:** um 400 na primeira chamada leva a uma segunda chamada com `response_format: { type: 'json_object' }`;
  - 401 gera `'auth'`; 404 gera `'model'`; 429 com `retry-after: 0` tenta 2 vezes e depois gera `'rate'`; `fetch` que lança gera `'network'`;
  - `errorMessage` nunca contém a chave (testar com uma chave conhecida no erro).
- [ ] **Step 3:** FAIL. **Step 4:** Implementar. **Step 5:** PASS; `npm run compile` e `npm run build`.
- [ ] **Step 6: Commit** `feat: adaptadores Anthropic e compatível com OpenAI`.

### Task 7: Geração com progresso

**Files:**
- Create: `src/ai/generate.ts`, `src/ui/state/useAiSuggestions.ts`
- Test: `tests/ai/generate.test.ts`

**Interfaces:**
- Consumes: as Tasks 1 a 6.
- Produces:
  ```ts
  // generate.ts (puro, com Provider injetado)
  export interface GenerateProgress { batch: number; batches: number }
  export async function generateProposal(args: {
    tree: BmNode[]; marks: MarksMap; scope: AiScope; provider: Provider; providerKind: ProviderConfig['kind']; model: string
    now: number; signal: AbortSignal; onProgress?: (p: GenerateProgress) => void
  }): Promise<Proposal>
  // useAiSuggestions.ts
  export function useAiSuggestions(tree: BmNode[] | null, marks: MarksMap): {
    provider: ProviderConfig | null; proposal: Proposal | null; progress: GenerateProgress | null; error: string | null
    saveProvider(cfg: ProviderConfig): Promise<void>
    testProvider(cfg: ProviderConfig): Promise<boolean>   // pede permissão no clique e grava se der certo
    generate(scope: AiScope): Promise<void>; cancel(): void
    setAccepted(itemIds: string[], value: boolean): void
    retarget(itemIds: string[], folderId: string, newPath: string[]): void
    rename(folderId: string, oldPath: string[], newName: string): void
    discard(): Promise<void>
  }
  ```

- [ ] **Step 1: Testes de `generateProposal`**, com um `Provider` falso:
  - os itens da regra de domínio entram com `source: 'regra'`, `confidence: 'alta'` e `reason: 'regra: domínio já está aqui'`, e não vão ao provedor;
  - lote com resposta inválida é refeito 1 vez e, se falhar de novo, conta em `failedBatches`, e os outros lotes continuam;
  - pastas novas do lote 1 viram candidatas no lote 2 (verificar que o `userPrompt` do lote 2 as contém);
  - `accepted` vale `false` para `baixa` e `true` para o resto;
  - um `signal` abortado depois do lote 1 devolve uma proposta parcial com os itens do lote 1, sem lançar;
  - `ProviderError('auth')` interrompe e é relançado.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar `generate.ts`. **Step 4:** PASS.
- [ ] **Step 5:** Implementar `useAiSuggestions`. Ele grava a proposta com `saveProposal` a cada mudança e com `clearProposal` em `discard`. Se `generate` encontrar uma proposta com itens não aplicados, pede confirmação (`window.confirm`).
- [ ] **Step 6:** `npm test` e `npm run compile`. **Commit** `feat: geração das sugestões em lotes com progresso`.

### Task 8: Telas e ligações

**Files:**
- Create: `src/ui/views/AiView.tsx`, `src/ui/components/AiSetup.tsx`, `src/ui/components/AiReview.tsx`
- Modify:
  - `src/core/route.ts`: `View` ganha `{ name: 'ai' }`, com a rota `#/ia`; atualizar `tests/core/route.test.ts`;
  - `src/ui/layout/Sidebar.tsx`: "Sugestões da IA" habilitada, navega para `{ name: 'ai' }`, sem "breve";
  - `src/ui/views/OverviewView.tsx`: o botão "Sugerir pastas com IA" habilitado, navegando para `#/ia`;
  - `src/ui/stepText.ts`: o passo `sem-categoria` com a ação "Sugerir com IA", que leva a `{ name: 'ai' }`; atualizar o teste;
  - `src/ui/layout/Shell.tsx`: rota `ai`;
  - `src/ui/styles.css`.
- Test: `tests/core/route.test.ts`, `tests/ui/stepText.test.ts` (atualizados)

**Interfaces:**
- Consumes: `useAiSuggestions` (Task 7), `planFromProposal`, `groupByTarget` (Task 5), `buildScope`, `applyDomainRule`, `estimateCost`, `maskKey`, `MovePicker` (recebe `options`), `runPlan`, `lib.notify`.

- [ ] **Step 1:** Atualizar os testes de rota (`formatRoute({name:'ai'}) === '#/ia'` e ida e volta) e de `stepText`. Rodar: FAIL. Implementar a rota e o texto: PASS.
- [ ] **Step 2: `AiSetup`** (seção 4.2 do design, tela 5 do quadro):
  - os três cartões, com escopo, "Pode criar pastas novas", provedor e o resumo "O que vai ser enviado";
  - o resumo usa `buildScope` + `applyDomainRule` + `estimateCost` para mostrar a quantidade, a contagem da regra e a faixa de custo ("abaixo de US$ X", ou "custo depende do provedor");
  - durante a geração: "Lote X de Y" e Cancelar.
- [ ] **Step 3: `AiReview`** (seção 4.4 do design, tela 6 do quadro):
  - os cartões de `groupByTarget`, com a caixa de pasta (`indeterminate` em seleção parcial), as etiquetas existente/nova, Renomear (`window.prompt`), as linhas com caixa, título e domínio, motivo, confiança e "Mudar pasta";
  - "Mudar pasta" abre o `MovePicker` com as candidatas do escopo mais as pastas novas da proposta. As novas usam ids sintéticos `nova:<newFolderKey>`, que o `retarget` traduz;
  - filtro "Só baixa confiança" e "Recolher pastas";
  - a linha recolhida "N já estão no lugar certo";
  - a barra fixa com "N de M aceitos · K pastas novas · R recusados ficam onde estão", **Descartar proposta** (com `confirm`) e **Aplicar N**;
  - Aplicar:
    - chama `planFromProposal`, com a árvore e as marcas lidas de novo;
    - pede `confirm` com o resumo;
    - roda `runPlan` com `shareBackup: false`;
    - mostra `lib.notify` com Desfazer (`planId`) e "N mudaram desde a sugestão", quando houver;
    - chama `discard()`.
- [ ] **Step 4: `AiView`:** mostra `AiReview` quando há proposta; senão, `AiSetup`.
- [ ] **Step 5:** `npm test`, `npm run compile` e `npm run build`.
- [ ] **Step 6: Commit** `feat: telas de sugestões da IA`.

### Task 9: Verificação e documentação

**Files:**
- Modify: `README.md` (status do marco 4, seção da IA, permissões), `PLANO.md` (marco 4 entregue), a seção 10 do design (marcar o que foi verificado).

- [ ] **Step 1:** No Chromium do WSL (ver a memória `teste-no-chromium-wsl`), interceptar `https://api.anthropic.com/*` com `page.route` e responder com JSON válido. Conferir:
  - geração com progresso;
  - revisão com baixa confiança desmarcada;
  - renomear;
  - mudar pasta;
  - aplicar, com backup e Desfazer;
  - que o corpo enviado não contém nenhuma URL completa.
- [ ] **Step 2:** Atualizar o README e o PLANO.
- [ ] **Step 3: Commit** `docs: marco 4 no README e no plano`.
- [ ] **Step 4:** Teste com a chave real fica com o Gustavo (seção 10 do design).
