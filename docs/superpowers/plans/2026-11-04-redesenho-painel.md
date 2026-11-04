# Redesenho do painel e do popup — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visão geral em formato de dashboard, Limpeza guiada, Backups simplificados, barra lateral nova, popup com resumo e rota no `#`, como descreve o design.

**Architecture:** Toda conta nova é função pura em `src/core/` (testada com Vitest). Os dados guardados ficam em `chrome.storage.local`, atrás de uma interface pequena que os testes trocam por um objeto em memória. Uma função `computeDashboard` alimenta o painel, a barra lateral e o popup, para que os números nunca divirjam. As telas React só desenham.

**Tech Stack:** React 19, TypeScript, WXT (Manifest V3), Vitest, `idb`, CSS próprio com os tokens de `src/ui/theme/tokens.ts`.

**Spec:** [`docs/superpowers/specs/2026-11-04-redesenho-painel-design.md`](../specs/2026-11-04-redesenho-painel-design.md). Quadro visual: https://claude.ai/artifact/2hrh5cvsUFPDNAZhbY7ChL (telas 1 a 4 e a barra lateral).

## Global Constraints

- Sem dependência nova: nada de biblioteca de UI, de gráficos ou de ícones. Gráficos são `div`s; ícones são SVG de traço inline (`stroke="currentColor"`, `aria-hidden="true"`).
- Sem nova versão do IndexedDB (continua 2). Dados novos só em `chrome.storage.local`, com as chaves `linkCheck`, `lastExportAt`, `inactiveDays` e `keepPolicy`.
- Toda contagem exclui a Lixeira da extensão (`findTrash`).
- Toda mudança nos favoritos continua passando por `runPlan` (backup → aplicar → diário → Desfazer).
- Temas claro, escuro e sistema valem para tudo, inclusive o popup. Cor nova só por token, coberta por `tests/ui/contrast.test.ts`.
- Interface em português do Brasil, com acentos. Botões de ícone com `aria-label` e `title`.
- A marca "não mexer" sai da barra lateral. A vista Organizar e o CSV não mudam.
- "Sugerir pastas com IA" e "Sugestões da IA" aparecem desabilitados, com "em breve".
- Depois de cada tarefa: `npm test` verde, `npm run compile` limpo e `npm run build` ok.

## Review Focus

1. **`chrome.storage.local` vazio, de outro formato ou corrompido** (primeira execução, valor editado à mão): cada leitura devolve o padrão, sem quebrar o painel nem o popup. O teste fica na Tarefa 2.
2. **Navegador sem nenhum favorito**: o dashboard e o popup mostram "Nenhum favorito ainda", sem `NaN%` e sem divisão por zero nas barras. O teste fica na Tarefa 4.
3. **`#` malformado ou de uma pasta que não existe mais** (favorito apagado por fora, endereço antigo): cai na Visão geral, sem erro. O teste fica na Tarefa 1, e a checagem da pasta inexistente, na Tarefa 6.
4. **Resultado de teste de links velho** (favorito quebrado já apagado, ou endereço repetido em duas pastas): conta pelos favoritos de agora. Um apagado não conta, e dois favoritos com o mesmo endereço quebrado contam os dois. O teste fica na Tarefa 4.
5. **Troca manual da cópia num grupo de duplicados e depois uma nova análise** que muda o grupo (a cópia escolhida foi apagada): a escolha manual que não existe mais é descartada e vale a política. Nunca um grupo fica sem nenhuma cópia. O teste fica na Tarefa 7.

---

### Task 1: Rota no `#`

**Files:**
- Modify: `src/core/route.ts`
- Modify: `src/ui/cleanupStart.ts` (remover; o conteúdo vira `CleanupTab`), `src/core/palette.ts` só se referir a `start`
- Create: `src/ui/state/useRoute.ts`
- Modify: `src/ui/layout/Shell.tsx` (trocar `useState<View>` por `useRoute`)
- Test: `tests/core/route.test.ts` (novo); remover `tests/ui/cleanupStart.test.ts`

**Interfaces:**
- Produces:
  - `export type CleanupTab = 'sem-uso' | 'duplicados' | 'quebrados' | 'pastas-vazias'`
  - `View` muda o caso da Limpeza para `{ name: 'cleanup'; tab?: CleanupTab }` (sai `start`).
  - `parseRoute(hash: string): View` e `formatRoute(view: View): string` em `src/core/route.ts`.
  - `useRoute(): [View, (v: View) => void]` em `src/ui/state/useRoute.ts`. Ele lê `location.hash` ao montar, escuta `hashchange` (botão voltar) e, ao navegar, usa `history.pushState` com `formatRoute`. Não faz `pushState` se o endereço não mudou.

- [ ] **Step 1: Testes** em `tests/core/route.test.ts`:
  - ida e volta: para cada `View` da tabela 4.7 do design, `parseRoute(formatRoute(v))` é igual a `v`. Entram `{name:'folder', id:'123'}` e cada `tab`.
  - `formatRoute({name:'overview'})` é `'#/'`, `formatRoute({name:'cleanup', tab:'duplicados'})` é `'#/limpeza/duplicados'` e `formatRoute({name:'folder', id:'42'})` é `'#/pasta/42'`.
  - `parseRoute('')`, `parseRoute('#')`, `parseRoute('#/xyz')`, `parseRoute('#/limpeza/abc')` e `parseRoute('#/pasta/')` devolvem `{name:'overview'}`. Exceção: `'#/limpeza/abc'` devolve `{name:'cleanup'}`, sem aba.
  - `parseRoute('#/pasta/a%2Fb')` devolve `{name:'folder', id:'a/b'}`, porque o id é codificado com `encodeURIComponent`.
  - Nenhum endereço carrega ação: não existe formato com `?testar` (seção 4.7 do design).
- [ ] **Step 2:** `npx vitest run tests/core/route.test.ts` → FAIL (`parseRoute is not a function`).
- [ ] **Step 3:** Implementar `parseRoute`/`formatRoute`. Trocar `start` por `tab` onde for usado (`Shell.runAction`, `OverviewView`, `CleanupView`) e apagar `cleanupStart.ts` e o seu teste. A Limpeza recebe `tab` e, por enquanto, mapeia `'sem-uso'` → analisar sem uso e `'duplicados'` → achar duplicados, como fazia `startAnalysis`. A Tarefa 7 substitui isso.
- [ ] **Step 4:** Criar `useRoute` e usá-lo no `Shell`. Se a rota for `folder` e a pasta não existir em `tree` (`findFolderNode(buildFolderTree(tree), id)` indefinido), o `Shell` renderiza a Visão geral e corrige o endereço com `history.replaceState`.
- [ ] **Step 5:** `npm test`, `npm run compile` e `npm run build` → verdes.
- [ ] **Step 6: Commit** `feat: endereço de cada tela no # do painel`.

### Task 2: Dados guardados em `chrome.storage.local`

**Files:**
- Create: `src/chrome/localStore.ts`
- Create: `src/core/linkCheckRecord.ts`
- Create: `src/storage/prefs.ts`
- Test: `tests/core/linkCheckRecord.test.ts`, `tests/storage/prefs.test.ts`

**Interfaces:**
- Produces:
  - `src/chrome/localStore.ts`: `export interface KeyValueStore { get(key: string): Promise<unknown>; set(key: string, value: unknown): Promise<void> }` e `export const chromeLocalStore: KeyValueStore`, implementado com `browser.storage.local.get(key)` e `.set({ [key]: value })`.
  - `src/core/linkCheckRecord.ts`:
    - `export type LinkCheckRecord = { checkedAt: number; complete: boolean; results: Record<string, LinkStatus> }`;
    - `export function recordLinkCheck(prev: LinkCheckRecord | null, statuses: Map<string, LinkStatus>, complete: boolean, now: number): LinkCheckRecord`. A chave em `results` é `normalizeUrl(url)`, e endereços com `normalizeUrl` nulo ficam de fora;
    - `export function statusOf(rec: LinkCheckRecord | null, url: string): LinkStatus | undefined`.
  - `src/storage/prefs.ts`, com todas as funções recebendo `store: KeyValueStore = chromeLocalStore`:
    - `export type KeepPolicy = 'antiga' | 'especifica' | 'usada'`;
    - `loadLinkCheck(store?): Promise<LinkCheckRecord | null>`, `saveLinkCheck(rec, store?)`;
    - `loadLastExportAt(store?): Promise<number | null>`, `markExported(now: number, store?)`;
    - `loadCleanupPrefs(store?): Promise<{ inactiveDays: number; keepPolicy: KeepPolicy }>`, `saveCleanupPrefs(patch: Partial<…>, store?)`.

- [ ] **Step 1: Testes de `recordLinkCheck`:**
  - completo: substitui tudo, `complete: true`, `checkedAt = now`;
  - cancelado com anterior: mescla e o novo vale mais (`prev.results['https://a.example'] = 'ok'` e o novo diz `'quebrado'` → `'quebrado'`), mantém o que só o anterior tinha, `complete: false`, `checkedAt = now`;
  - cancelado sem anterior (primeiro teste): `complete: false` e só os resultados novos;
  - `'HTTPS://A.example/?utm_source=x'` vira a chave `'https://a.example'`;
  - `'javascript:x'` não entra;
  - `statusOf` acha pela forma normalizada.
- [ ] **Step 2: Testes de `prefs.ts`**, com um `KeyValueStore` em memória (um `Map`):
  - padrões com o armazenamento vazio: `inactiveDays = 365`, `keepPolicy = 'antiga'`, `lastExportAt = null`, `linkCheck = null`;
  - **Review Focus 1:** valores inválidos voltam ao padrão sem lançar erro: `inactiveDays: 'abc'`, `inactiveDays: -5`, `inactiveDays: 0`, `keepPolicy: 'x'`, `lastExportAt: 'ontem'` e `linkCheck: { checkedAt: 1 }` (sem `results`) ou `linkCheck: 'lixo'` → `null`. Um `results` com status desconhecido descarta só aquela entrada;
  - ida e volta de cada `save*`/`load*`;
  - `saveCleanupPrefs({ keepPolicy: 'usada' })` não apaga `inactiveDays`.
- [ ] **Step 3:** Rodar os dois testes → FAIL.
- [ ] **Step 4:** Implementar os três arquivos. Cada `load*` valida o formato e devolve o padrão quando não reconhece.
- [ ] **Step 5:** Rodar → PASS; `npm test` e `npm run compile`.
- [ ] **Step 6: Commit** `feat: guardar teste de links, exportação e preferências da limpeza`.

### Task 3: Qual cópia fica nos duplicados

**Files:**
- Modify: `src/core/duplicates.ts`
- Modify: `src/core/overview.ts` (repassar a política; ver Task 4)
- Test: `tests/core/duplicates.test.ts`

**Interfaces:**
- Consumes: `KeepPolicy` (Task 2).
- Produces: `findDuplicates(links: FlatLink[], policy: KeepPolicy = 'antiga'): DuplicateGroup[]`, com o mesmo formato de `DuplicateGroup` (`keep`, `extras`).

- [ ] **Step 1: Testes** num grupo de três cópias A, B e C:
  - A: `dateAdded` 100, caminho com 2 níveis, sem `dateLastUsed`;
  - B: `dateAdded` 200, caminho com 4 níveis, `dateLastUsed` 50;
  - C: `dateAdded` 300, caminho com 3 níveis, `dateLastUsed` 900.
  
  Resultado esperado de `keep`: `'antiga'` → A, `'especifica'` → B e `'usada'` → C.
  
  Empates:
  - `'especifica'` com a mesma profundidade fica com a mais antiga;
  - `'usada'` com as duas cópias sem registro fica com a mais antiga;
  - sem segundo argumento, o comportamento é igual a `'antiga'`. Os testes atuais continuam verdes.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar a ordenação por política (regras da seção 5.6 do design). **Step 4:** → PASS; `npm test`.
- [ ] **Step 5: Commit** `feat: política de qual cópia fica nos duplicados`.

### Task 4: Números do dashboard

**Files:**
- Create: `src/core/dashboard.ts`
- Modify: `src/core/overview.ts`: `computeOverview` passa a receber `thresholdDays` e `policy`; ou é absorvido por `computeDashboard` e apagado, se nada mais o usar.
- Test: `tests/core/dashboard.test.ts`

**Interfaces:**
- Consumes: `findInactive`, `findDuplicates(links, policy)`, `uncategorizedLinks`, `sidebarFolders`, `flattenLinks`, `findTrash`, `LinkCheckRecord` e `statusOf` (Task 2), `KeepPolicy`.
- Produces:
  ```ts
  export interface DashboardInput { now: number; inactiveDays: number; keepPolicy: KeepPolicy; linkCheck: LinkCheckRecord | null }
  export interface Dashboard {
    total: number; folderCount: number
    inactive: number; duplicates: number; broken: number
    uncategorized: number; inFolders: number; organizedPct: number   // Math.floor; 0 quando total = 0
    review: number                                                   // tamanho de reviewIds
    reviewIds: Set<string>
    trash: number
    usage: { thisMonth: number; months1to3: number; months3to12: number; overYear: number; noRecord: number }
    topFolders: { id: string | null; title: string; count: number }[]  // id null = Sem categoria; no máximo 6
    linkCheck: { state: 'never' | 'partial' | 'done'; checkedAt: number | null }
  }
  export function computeDashboard(tree: BmNode[], input: DashboardInput): Dashboard
  ```
  `folderCount` conta as pastas fora das raízes do Chrome e fora da Lixeira.

- [ ] **Step 1: Testes** (com uma árvore pequena feita no próprio teste, no estilo de `tests/core/folders.test.ts`):
  - `review` é a união sem repetir: um favorito sem uso **e** cópia a mais conta 1 vez;
  - `uncategorized + inFolders === total`;
  - `organizedPct` arredonda para baixo: com 2 de 3 em pastas dá 66;
  - **Review Focus 2:** com a árvore só com as raízes vazias, `total = 0`, `organizedPct = 0`, `topFolders` vem vazio (pastas e "Sem categoria" com contagem 0 ficam de fora da lista), `usage` fica todo em zero e nada é `NaN`;
  - `usage`: um favorito usado há 30 dias cai em `thisMonth`, 31 dias em `months1to3`, 90 dias em `months1to3`, 91 em `months3to12`, 365 em `months3to12`, 366 em `overYear` e sem `dateLastUsed` em `noRecord`. As faixas são fixas e **não** mudam com `inactiveDays`;
  - `topFolders`: só pastas com contagem maior que 0, entre as subpastas de primeiro nível das três raízes, sem a Lixeira, mais "Sem categoria"; ordem decrescente pela contagem da subárvore, empate pela ordem da árvore, no máximo 6;
  - **Review Focus 4:**
    - um resultado de `linkCheck` com endereço quebrado que não existe mais na árvore não conta em `broken`;
    - dois favoritos com o mesmo endereço quebrado contam 2;
    - `incerto` não conta;
    - `ok` não conta;
  - `linkCheck.state`: `null` → `'never'`; `complete: false` → `'partial'`; `complete: true` → `'done'`;
  - favoritos na Lixeira não entram em nenhuma contagem, exceto `trash`;
  - `inactiveDays: 30` aumenta `inactive` em relação a `365` na mesma árvore.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar `computeDashboard`. **Step 4:** → PASS; `npm test`.
- [ ] **Step 5: Commit** `feat: números do dashboard numa função só`.

### Task 5: Próximos passos

**Files:**
- Modify: `src/core/dashboard.ts`
- Test: `tests/core/dashboard.test.ts`

**Interfaces:**
- Consumes: `Dashboard` (Task 4).
- Produces:
  ```ts
  export type StepId = 'duplicados' | 'testar-links' | 'quebrados' | 'sem-uso' | 'sem-categoria' | 'backup'
  export interface NextStep { id: StepId; count: number; done: boolean }
  export function nextSteps(d: Dashboard, lastBackupAt: number | null, now: number): NextStep[]
  ```
  A função devolve sempre os 6 itens, na ordem da seção 5.5 do design. Quem desenha escolhe quantos mostrar: o painel mostra os pendentes até 4 e completa com os resolvidos; o popup mostra o primeiro pendente. O texto e o destino de cada `StepId` ficam na interface (Task 8 e Task 10).

- [ ] **Step 1: Testes:**
  - ordem fixa dos 6 ids;
  - `duplicados.done` vale `duplicates === 0`;
  - `testar-links` fica pendente com `state` `'never'` ou `'partial'`, ou com `'done'` e `checkedAt` mais antigo que 30 dias (com 30 dias exatos ainda está resolvido; com 30 dias e 1 ms fica pendente);
  - `quebrados.done` vale `broken === 0`;
  - `sem-uso` e `sem-categoria` seguem as contagens;
  - `backup` está resolvido com `lastBackupAt` de até 7 dias e pendente com `null` ou mais antigo;
  - `count` traz o número de cada passo (0 para `testar-links` e `backup`).
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat: lista de próximos passos`.

### Task 6: Ícones, barra lateral, topo e dados do painel

**Files:**
- Create: `src/ui/components/Icon.tsx`
- Create: `src/ui/state/useDashboard.ts`
- Modify: `src/storage/journal.ts` (acrescentar `listEntries`)
- Modify: `src/ui/layout/Sidebar.tsx`, `src/ui/layout/Topbar.tsx`, `src/ui/layout/Shell.tsx`, `src/ui/styles.css`
- Test: `tests/storage/journal.test.ts` (novo, no padrão dos testes existentes de `tests/storage/`)

**Interfaces:**
- Consumes: `computeDashboard`, `nextSteps`, os `load*` da Task 2, `useRoute` (Task 1), `listSnapshots`.
- Produces:
  - `Icon({ name, size? }: { name: IconName; size?: number })`, com `IconName = 'grid' | 'broom' | 'list' | 'sparkle' | 'folder' | 'trash' | 'archive' | 'search' | 'moon' | 'sun' | 'contrast' | 'chevron-right' | 'chevron-down' | 'expand-all' | 'collapse-all' | 'plus' | 'check' | 'more'`. Os desenhos seguem o quadro.
  - `listEntries(limit: number): Promise<JournalEntry[]>`, do mais recente para o mais antigo.
  - `useDashboard(tree: BmNode[] | null)`, que devolve:
    - `dashboard: Dashboard | null`;
    - `steps: NextStep[]`;
    - `lastBackupAt: number | null`;
    - `lastExportAt: number | null`;
    - `prefs: { inactiveDays; keepPolicy }`;
    - `setPrefs(patch)`, que grava e recalcula;
    - `setLinkCheck(rec)`, que grava e recalcula;
    - `recent: JournalEntry[]` (até 5);
    - `refresh()`, que lê de novo o armazenamento, os backups e o diário.
  
  O hook lê o armazenamento ao montar e quando `tree` muda. O `Shell` o chama uma vez e passa o resultado para a barra lateral, o topo e as telas.

- [ ] **Step 1: Teste** de `listEntries`: devolve na ordem certa e respeita `limit`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Barra lateral** (seção 4.1 do design e quadro):
  - grupos Visão geral, **Tarefas** e **Pastas**, e o rodapé com Lixeira e Backups;
  - o selo da Limpeza usa `dashboard.review`;
  - Organizar mostra "N soltos", com `dashboard.uncategorized`;
  - "Sugestões da IA" fica desabilitada, com a etiqueta "novo";
  - os botões expandir, recolher e nova pasta viram ícones, com `aria-label`/`title` "Expandir todas as pastas", "Recolher todas as pastas" e "Nova pasta";
  - Backups mostra a idade do último backup, verde até 7 dias e laranja depois (tokens `okText`/`warnText`);
  - **remover** o cadeado: tirar `lockedFolderIds`/`onToggleFolderLock` das props e o `lockedFolderIds` do `Shell`, se não sobrar uso.
- [ ] **Step 4: Topo** (seção 4.2): a busca `Ctrl K` larga, à esquerda, com o texto "Buscar favoritos, pastas ou ações…"; à direita, "Fazer backup" e o tema. O botão "Sugerir pastas · em breve" sai daqui. O breadcrumb continua só nas telas de pasta.
- [ ] **Step 5:** `npm test`, `npm run compile` e `npm run build`. Verificação manual no Chrome: a barra lateral e o topo aparecem nos dois temas, as contagens batem com a Visão geral atual, e um `#/pasta/<id-apagado>` cai na Visão geral (**Review Focus 3**).
- [ ] **Step 6: Commit** `feat: barra lateral, topo e ícones novos`.

### Task 7: Limpeza guiada

**Files:**
- Create: `src/ui/duplicateChoice.ts`
- Create: `src/ui/components/DuplicateGroups.tsx`, `src/ui/components/ActionBar.tsx`
- Modify: `src/ui/views/CleanupView.tsx`, `src/ui/candidates.ts` (se precisar), `src/ui/styles.css`
- Test: `tests/ui/duplicateChoice.test.ts`

**Interfaces:**
- Consumes: `CleanupTab` (Task 1), `findDuplicates(links, policy)` (Task 3), `recordLinkCheck`/`saveLinkCheck` e `useDashboard().setPrefs`/`setLinkCheck` (Tasks 2 e 6).
- Produces, em `src/ui/duplicateChoice.ts`:
  ```ts
  export type KeepOverrides = Map<string, string>   // chave do grupo (normalizeUrl) → id da cópia que fica
  export function applyKeep(groups: DuplicateGroup[], overrides: KeepOverrides): DuplicateGroup[]
  export function groupKey(g: DuplicateGroup): string
  export function trashIds(groups: DuplicateGroup[], included: Set<string>): string[]   // os extras dos grupos incluídos
  ```

- [ ] **Step 1: Testes de `duplicateChoice`:**
  - um override troca o `keep` do grupo, e o `keep` antigo vai para `extras`;
  - **Review Focus 5:** um override cujo id não está mais no grupo é ignorado e vale a política;
  - `trashIds` nunca devolve todas as cópias de um grupo;
  - um grupo fora de `included` não entra.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Tela** (seção 4.4 do design e quadro):
  - **Abas:** quatro cartões-abas com contagem. Ao abrir, sem uso, duplicados e pastas vazias são calculados sozinhos. A aba inicial é a `tab` da rota ou, sem rota, a primeira com itens. Trocar de aba atualiza a rota (`#/limpeza/<aba>`).
  - **Sem uso:** um seletor de limiar (3, 6, 12 e 24 meses), gravado por `setPrefs({ inactiveDays })`.
  - **Duplicados:**
    - `DuplicateGroups` mostra os grupos em cartões, de 20 em 20;
    - cada cópia tem um rádio "manter" e as etiquetas "fica"/"vai p/ Lixeira";
    - o seletor "Manter qual cópia" (a mais antiga, a da pasta mais específica, a mais usada recentemente) grava `keepPolicy`;
    - as trocas manuais vivem em `KeepOverrides`, só na memória, e são descartadas a cada nova análise.
  - **Links quebrados:**
    - mostra o resultado guardado; sem resultado, o botão "Testar agora";
    - ao testar, chama `requestLinkCheckPermission()` antes de qualquer `await`;
    - ao terminar ou cancelar, grava com `recordLinkCheck(prev, statuses, !aborted, Date.now())`;
    - os incertos nunca vêm marcados.
  - **Pastas vazias:** a lista atual.
  - **`ActionBar` fixa no rodapé:**
    - em Duplicados, "N escolhidos · X vão para a Lixeira · Y ficam";
    - nas outras abas, "N escolhidos";
    - os botões "Desmarcar todos" e "Mover X para a Lixeira";
    - continuam a confirmação atual e o `runPlan`.
  - **Sai da Limpeza:** o botão "Desfazer: …" e o "Esvaziar a Lixeira…".
  - Depois de aplicar, chamar `useDashboard().refresh()`.
  - **Entrada pelo dashboard:** "Testar agora" do dashboard e o passo "Testar os links" do painel navegam para `#/limpeza/quebrados` e iniciam o teste no mesmo clique. Para isso, a função de teste da Limpeza fica num lugar que o `Shell` alcança (um callback `startLinkCheck` exposto pelo `Shell`, ou o hook). A rota nunca inicia o teste sozinha.
- [ ] **Step 4:** `npm test`, `npm run compile` e `npm run build`. Verificação manual: as abas chegam calculadas; trocar o seletor muda as sugestões; uma troca manual e depois "Mover" leva as cópias certas, e Desfazer devolve tudo; recarregar a página mostra o resultado do teste de links.
- [ ] **Step 5: Commit** `feat: limpeza guiada com abas e duplicados em grupos`.

### Task 8: Visão geral (dashboard)

**Files:**
- Modify: `src/ui/views/OverviewView.tsx` (reescrever), `src/ui/styles.css`
- Create: `src/ui/stepText.ts`
- Test: `tests/ui/stepText.test.ts`

**Interfaces:**
- Consumes: `Dashboard`, `NextStep`, `recent`, `lastBackupAt` (Task 6), `View`/rota (Task 1), `startLinkCheck` (Task 7), `lib.undo(planId)`.
- Produces: `stepText(step: NextStep): { title: string; hint: string; action: string }`, com o texto de cada passo.

  | id | título | ação |
  |---|---|---|
  | `duplicados` | "Juntar N duplicados" | "Revisar" |
  | `testar-links` | "Testar os links" | "Testar" |
  | `quebrados` | "Revisar N links quebrados" | "Revisar" |
  | `sem-uso` | "Revisar N favoritos sem uso" | "Revisar" |
  | `sem-categoria` | "Dar pasta a N favoritos sem categoria" | "Abrir" |
  | `backup` | pendente: "Fazer um backup"; resolvido: "Backup em dia" | "Fazer backup" |

  Plural correto para N = 1 ("Juntar 1 duplicado").

- [ ] **Step 1: Teste** de `stepText`: os textos e o plural.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Tela** (seção 4.3 do design e quadro):
  - **Cabeçalho:** a linha de resumo e o botão "Sugerir pastas com IA", desabilitado com "em breve". O cabeçalho mostra "Desfazer: <rótulo>" quando `recent[0]` existe; senão, "nada pendente para desfazer".
  - **Cartão Organização:**
    - a barra de **dois** segmentos, com o token `primary` para em pastas e `textTertiary` para sem categoria;
    - a legenda com links;
    - a linha laranja "N a revisar →".
  - **Cartões:**
    - Sem uso e Duplicados, cada um abrindo a sua aba;
    - Links quebrados: "—"/"nunca testados"/"Testar agora", "N" com "testado há X", ou "teste incompleto · há X". Para "há X", reusar `lastUsedLabel` ou criar `ageLabel` em `src/ui/format.ts`, com teste.
  - **Próximos passos:** até 4 pendentes, completados com os resolvidos (com ✓).
  - **Maiores pastas:** barras horizontais. Um clique navega para a pasta ou para Sem categoria.
  - **Uso:** colunas com as 5 faixas; "+1 ano" em `warnText`; `role="img"` com `aria-label` listando os números.
  - **Atividade recente:** `recent`, com Desfazer só no primeiro.
  - A lista "Sem categoria" sai da tela.
- [ ] **Step 4:** `npm test`, `npm run compile` e `npm run build`. Verificação manual nos dois temas: cada clique leva à tela certa; com 0 favoritos (num perfil vazio) não aparece `NaN`.
- [ ] **Step 5: Commit** `feat: visão geral em formato de dashboard`.

### Task 9: Backups

**Files:**
- Create: `src/core/deletedSearch.ts`
- Create: `src/ui/components/RestoreDialog.tsx`, `src/ui/components/MoreMenu.tsx`
- Modify: `src/ui/views/BackupsView.tsx` (reescrever), `src/ui/styles.css`
- Test: `tests/core/deletedSearch.test.ts`

**Interfaces:**
- Consumes: `listSnapshots`, `markExported` (Task 2), `lastExportAt` (Task 6), as funções atuais de restaurar tudo e restaurar um item, usadas hoje em `BackupsView`.
- Produces:
  ```ts
  export interface DeletedHit { snapshotId: string; createdAt: number; link: BmLink }
  export function findDeleted(snapshots: Snapshot[], current: BmNode[], query: string, limit = 50): DeletedHit[]
  ```

- [ ] **Step 1: Testes de `findDeleted`:**
  - com menos de 2 caracteres, devolve `[]`;
  - busca no título ou no endereço, sem diferenciar acentos nem maiúsculas (reusar a normalização de `src/core/text.ts`);
  - um favorito que ainda existe na árvore atual (pelo `normalizeUrl`) não aparece;
  - o mesmo favorito em vários backups aparece uma vez só, com o backup **mais recente**;
  - um favorito na Lixeira do backup não aparece;
  - respeita `limit`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Tela** (seção 4.5 do design e quadro):
  - o cabeçalho, com "Fazer backup agora" como botão principal;
  - três cartões. "Cópia fora do navegador" fica em `warnText` com mais de 30 dias ou `null` ("nunca");
  - o histórico, uma linha por backup:
    - "há X" e a data;
    - o motivo;
    - "N favoritos · M pastas", contado no `tree` do snapshot;
    - a etiqueta automático/manual;
    - **Restaurar…**, que abre o `RestoreDialog`, com "Restaurar tudo" e "Restaurar um item" (a busca por item atual);
    - o menu **⋯**, com Exportar HTML e Exportar JSON, que chamam `markExported(Date.now())` e depois `refresh()`;
  - a busca "Achar um favorito apagado…", com `findDeleted` e o botão Restaurar por resultado;
  - o `MoreMenu` fecha com `Esc` e com clique fora, e se abre pelo teclado.
- [ ] **Step 4:** `npm test`, `npm run compile` e `npm run build`. Verificação manual: exportar atualiza o cartão; apagar um favorito pelo Chrome, buscar e restaurar.
- [ ] **Step 5: Commit** `feat: backups com cartões, restaurar em diálogo e busca de apagados`.

### Task 10: Popup

**Files:**
- Modify: `src/entrypoints/popup/main.tsx` (reescrever)
- Create: `src/ui/popup/PopupView.tsx`, `src/ui/popup.css` (ou classes em `styles.css`)
- Test: nenhum novo de lógica, porque o popup só usa `computeDashboard`, `nextSteps`, `stepText` e `formatRoute`, que já estão testados.

**Interfaces:**
- Consumes: `computeDashboard`, `nextSteps`, `stepText`, `formatRoute`, os `load*` da Task 2, `listSnapshots`, `makeBackup`.

- [ ] **Step 1:**
  - Importar `../../ui/styles.css` no popup. O tema já é aplicado por `init.ts`, que está no `index.html`.
  - Largura de 360 px.
  - Ler a árvore, as preferências, o `linkCheck` e o último backup, e chamar `computeDashboard`.
- [ ] **Step 2:** Desenhar como na seção 4.6 do design e na tela 4 do quadro:
  - a marca e "N favoritos · M pastas";
  - o cartão Organização, com dois segmentos;
  - três números: sem uso, duplicados e a revisar;
  - o primeiro passo pendente, ou "Tudo em dia";
  - o rodapé, com o último backup, "Fazer backup" e "Abrir painel".
  
  Cada clique abre `browser.tabs.create({ url: browser.runtime.getURL('/dashboard.html') + formatRoute(view) })` e depois `window.close()`. Os destinos:
  - sem uso → `#/limpeza/sem-uso`;
  - duplicados → `#/limpeza/duplicados`;
  - a revisar → `#/limpeza`;
  - o passo `testar-links` → `#/limpeza/quebrados`, sem iniciar o teste;
  - o passo `sem-categoria` → `#/sem-categoria`;
  - o passo `backup` → faz o backup ali mesmo.
- [ ] **Step 3:** O estado do backup: "Fazendo backup…" e, depois, "Backup feito" no lugar da linha do último backup. Em caso de erro, "Erro: …".
- [ ] **Step 4:** `npm run compile` e `npm run build`. Verificação manual: o popup abre rápido, segue o tema, e cada atalho abre a tela certa.
- [ ] **Step 5: Commit** `feat: popup com resumo e atalhos`.

### Task 11: Documentação e verificação

**Files:**
- Modify: `README.md` (status, telas e capturas, se houver), `docs/melhorias.md`, `docs/superpowers/specs/2026-11-04-redesenho-painel-design.md` (seção 9: marcar o que foi verificado)

- [ ] **Step 1:** Atualizar o README: o que o painel e o popup mostram agora. Manter o número de testes atualizado.
- [ ] **Step 2:** Em `docs/melhorias.md`, registrar que o cadeado saiu da barra lateral e que o redesenho da marca continua em espera.
- [ ] **Step 3:** Passar o checklist da seção 9 do design com o Gustavo no Chrome e anotar o resultado.
- [ ] **Step 4: Commit** `docs: redesenho do painel no README e na lista de melhorias`.
