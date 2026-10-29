# Organizar Favoritos — Marcos 0 a 2 (base, backup, limpeza) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma extensão Chrome que lê os favoritos, faz backup/restauração e permite limpar (sem uso, duplicados, quebrados) com pré-visualização, Lixeira e desfazer.

**Architecture:** Lógica pura e testável em `src/core/` (sem dependência do Chrome); o acesso ao Chrome passa pela interface `BookmarksApi` (`src/chrome/`), injetada nas funções que mudam favoritos. Toda mudança é um `Plan` executado por `runPlan`, que grava backup antes, aplica e registra um diário para desfazer. A interface é uma página completa da extensão (React) mais um popup de atalhos.

**Tech Stack:** WXT, React, TypeScript, Vitest, `idb` (IndexedDB), `fake-indexeddb` (testes). Manifest V3, só Chrome.

**Spec:** `PLANO.md` (raiz do repositório). Este plano cobre os marcos 0, 1 e 2 do §7.

## Global Constraints

- React + TypeScript, Manifest V3, só Chrome, uso pessoal. Build com WXT. Testes com Vitest. CSS simples, sem biblioteca de UI; estado com hooks do React.
- Permissões: `bookmarks`, `storage`, `unlimitedStorage`; hosts **opcionais** (`optional_host_permissions: ["<all_urls>"]`) pedidos só ao testar links. **Sem** `history`.
- Fluxo de toda mudança: **plano → pré-visualização → backup → aplicar → registro de desfazer**. Se o backup falhar, nada é aplicado.
- "Apagar" = mover para a pasta **Lixeira**; esvaziar a Lixeira é ação manual e separada.
- Pastas raiz do Chrome (filhas diretas do nó raiz) nunca são renomeadas, movidas ou apagadas.
- Restaurar **nunca sobrescreve**: cria a pasta `Restaurado em <YYYY-MM-DD HH:mm>`.
- Backups em IndexedDB, mantendo os **últimos 20**; exportação em JSON e HTML (Netscape).
- Limiar de "sem uso": **365 dias**, ajustável. `dateLastUsed` ausente ou `0` conta como ausente: cai para `dateAdded` e o motivo é `sem-registro`.
- Estados de link: `ok` (2xx/3xx), `quebrado` (**só** 404 ou 410), `incerto` (todo o resto, incluindo timeout e erro de rede). `incerto` nunca entra sozinho em plano de exclusão. Ignorar URLs que não sejam `http(s)` e hosts locais/privados.
- Interface e mensagens em português. Licença MIT. Chave de API e dados pessoais nunca entram no repositório.
- Commits em português no formato `feat:`, `test:`, `chore:`, `docs:`.

## Review Focus

Entradas que o design implica mas que nenhum teste "feliz" exercita, da mais provável à menos:

1. **URLs que não são web** (`javascript:`, `chrome://`, `file://`, `data:`, favoritelets): não são testadas como "quebradas" nem entram em duplicados. → Tasks 9 e 11.
2. **`dateLastUsed` ausente ou `0`** em favoritos antigos: nunca podem virar "sem uso" por engano de data 1970. → Task 10.
3. **Backup falha** (IndexedDB indisponível ou cheio): `runPlan` aborta antes de qualquer mudança. → Task 6.
4. **Favorito movido ou apagado fora da extensão** entre o plano e a aplicação (id inexistente): só aquela operação falha e é reportada; o resto segue e o desfazer cobre só o que foi aplicado. → Task 6.
5. **Coleção grande** (dezenas de milhares): a verificação respeita o limite de concorrência e a lista de revisão não renderiza tudo de uma vez. → Tasks 11 e 13.

---

## File Structure

```
organizar-favoritos/
  wxt.config.ts  package.json  tsconfig.json  vitest.config.ts  LICENSE  .gitignore
  src/
    entrypoints/
      dashboard/{index.html,main.tsx,App.tsx}   # página completa (abas: Visão geral, Limpeza, Backups)
      popup/{index.html,main.tsx}               # atalhos: Fazer backup, Abrir painel
    core/
      types.ts        # BmNode, FlatLink, Snapshot, Operation, Plan, JournalEntry
      tree.ts         # flattenLinks, findNode, isProtected, otherBookmarksId
      snapshot.ts     # createSnapshot, snapshotToJson, snapshotToNetscapeHtml
      plan.ts         # runPlan, undoLast, BackupFailedError
      restore.ts      # planRestoreAll, planRestoreItem
      url.ts          # normalizeUrl, isCheckableUrl
      duplicates.ts   # findDuplicates
      inactive.ts     # findInactive
      linkStatus.ts   # classifyStatus, checkLinks
      cleanup.ts      # buildCleanupPlan, findEmptyFolders, TRASH_TITLE
    chrome/
      bookmarksApi.ts # chromeBookmarksApi: BookmarksApi
      permissions.ts  # requestLinkCheckPermission
    storage/
      db.ts           # abre o IndexedDB (stores: snapshots, journal)
      snapshots.ts    # saveSnapshot, listSnapshots, getSnapshot, pruneSnapshots
      journal.ts      # saveEntry, lastEntry, deleteEntry
    ui/               # componentes React
  tests/              # espelha src/core e src/storage
  docs/decisions/
```

---

## Marco 0 — Base

### Task 1: Esqueleto WXT + React + TypeScript + Vitest

**Files:**
- Create: projeto WXT na raiz, `wxt.config.ts`, `vitest.config.ts`, `LICENSE` (MIT, ano 2026, Gustavo Walien), `.gitignore` (inclui `node_modules`, `.output`, `.wxt`)
- Create: `src/entrypoints/dashboard/{index.html,main.tsx,App.tsx}`, `src/entrypoints/popup/{index.html,main.tsx}`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts `npm run dev`, `build`, `compile` (`tsc --noEmit`), `test` (`vitest run`); página `dashboard.html` e popup carregáveis; `wxt.config.ts` com `srcDir: 'src'`, módulo React e manifesto com nome "Organizar Favoritos", permissões `bookmarks`, `storage`, `unlimitedStorage`, `optional_host_permissions: ["<all_urls>"]`.

- [ ] **Step 1: Criar o projeto** na raiz existente com o inicializador do WXT, template React + TypeScript e npm. Antes, registrar em `docs/decisions/0000-stack.md` as versões instaladas de `wxt`, `react` e `vitest` (`npm ls --depth=0`) — o design pede para conferir a versão e a manutenção do WXT antes de depender dele.
- [ ] **Step 2: Escrever o teste de fumaça** que prova que o Vitest roda:

```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => { it('roda', () => { expect(1 + 1).toBe(2) }) })
```

- [ ] **Step 3: Rodar** `npm test` → PASS. Rodar `npm run compile` → sem erros.
- [ ] **Step 4: Configurar o manifesto** em `wxt.config.ts` com os valores das Global Constraints. A página `dashboard` é uma _unlisted page_ (aberta com `browser.runtime.getURL('/dashboard.html')`); o popup tem os botões "Abrir painel" e "Fazer backup" (este ainda desabilitado). O dashboard mostra o título "Organizar Favoritos" com três abas vazias.
- [ ] **Step 5: Resolver o fluxo WSL → Chrome do Windows.** Rodar `npm run build`; no Chrome do Windows, `chrome://extensions` → modo desenvolvedor → "Carregar sem compactação" apontando para `\\wsl.localhost\<distro>\home\<usuario>\organizar-favoritos\.output\chrome-mv3`. Se o `npm run dev` não abrir o navegador no WSL, desativar o runner do WXT na config (conferir o nome da opção na documentação da versão instalada). Documentar o fluxo que funcionou em `docs/decisions/0000-stack.md`.
- [ ] **Step 6: Verificação manual:** o ícone da extensão aparece, o popup abre e "Abrir painel" abre a página completa.
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: esqueleto WXT + React + TypeScript + Vitest"
```

### Task 2: Tipos do domínio e leitura da árvore de favoritos

**Files:**
- Create: `src/core/types.ts`, `src/core/tree.ts`, `src/chrome/bookmarksApi.ts`
- Modify: `src/entrypoints/dashboard/App.tsx` (aba Visão geral)
- Test: `tests/core/tree.test.ts`

**Interfaces:**
- Produces (em `types.ts`):

```ts
export interface BmLink { kind: 'link'; id: string; parentId: string; index?: number; title: string; url: string; dateAdded: number; dateLastUsed?: number }
export interface BmFolder { kind: 'folder'; id: string; parentId?: string; index?: number; title: string; dateAdded?: number; children: BmNode[] }
export type BmNode = BmLink | BmFolder
export interface FlatLink extends BmLink { path: string[] }   // títulos das pastas ancestrais, sem o nó raiz
export interface BookmarksApi {
  getTree(): Promise<BmNode[]>                       // retorna [raiz]
  get(id: string): Promise<BmNode | undefined>       // com `index`
  createFolder(parentId: string, title: string): Promise<string>   // devolve o novo id
  createLink(parentId: string, title: string, url: string): Promise<string>
  move(id: string, parentId: string, index?: number): Promise<void>
  remove(id: string): Promise<void>                  // nó ou pasta inteira
}
```

- Produces (em `tree.ts`): `flattenLinks(root: BmNode[]): FlatLink[]`; `findNode(root: BmNode[], id: string): BmNode | undefined`; `isProtected(root: BmNode[], id: string): boolean` (verdadeiro para o nó raiz e suas filhas diretas); `otherBookmarksId(root: BmNode[]): string` (a filha da raiz com id `'2'`, senão a primeira que não seja `'1'`).
- Produces (em `chrome/bookmarksApi.ts`): `export const chromeBookmarksApi: BookmarksApi` convertendo `chrome.bookmarks.BookmarkTreeNode` (sem `url` = pasta) para `BmNode`.

- [ ] **Step 1: Escrever o teste** com uma árvore de exemplo (raiz `0` → `1` Barra → pasta `Dev` → link; `2` Outros → link):

```ts
it('flattenLinks devolve o caminho das pastas, sem a raiz', () => {
  const links = flattenLinks(sampleTree)
  expect(links.find(l => l.id === '10')!.path).toEqual(['Barra de favoritos', 'Dev'])
})
it('isProtected é verdadeiro para a raiz e suas filhas diretas, falso para o resto', () => {
  expect(isProtected(sampleTree, '0')).toBe(true)
  expect(isProtected(sampleTree, '1')).toBe(true)
  expect(isProtected(sampleTree, '5')).toBe(false)   // pasta Dev
})
it('otherBookmarksId acha a pasta de id 2', () => {
  expect(otherBookmarksId(sampleTree)).toBe('2')
})
```

- [ ] **Step 2: Rodar** `npx vitest run tests/core/tree.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `types.ts`, `tree.ts` e `chromeBookmarksApi` (mapeamento direto de `dateAdded`, `dateLastUsed`, `index`, `children`).
- [ ] **Step 4: Rodar** o teste → PASS.
- [ ] **Step 5: Mostrar na aba Visão geral** o total de favoritos, o total de pastas e quantos favoritos têm `dateLastUsed`. Verificação manual com a árvore real: **anotar em `docs/decisions/0001-date-last-used.md`** a porcentagem com `dateLastUsed` preenchido e o que o Chrome devolve para os nunca abertos (ausente ou `0`). Esse resultado decide o texto do motivo `sem-registro` na Task 10.
- [ ] **Step 6: Commit** `feat: tipos do domínio e leitura da árvore de favoritos`.

### Task 3: Teste isolado — chamar o Anthropic direto do navegador

**Files:**
- Create: `docs/decisions/0002-anthropic-browser-access.md`
- Create (descartável, não commitar): página temporária fora do repositório ou aba `dashboard` local

- [ ] **Step 1:** Com uma chave de API do console da Anthropic (fornecida por você, **não** gravada em arquivo do repositório), fazer uma chamada mínima à API de mensagens a partir da página do painel, com e sem o cabeçalho de acesso direto do navegador. Pedir ao Gustavo para colar a chave só no campo da página temporária.
- [ ] **Step 2:** Registrar em `0002-anthropic-browser-access.md`: URL e cabeçalhos que funcionaram, o erro sem o cabeçalho, o modelo usado e o custo aproximado da chamada. Se não funcionar, registrar a alternativa (ex.: passar por `fetch` do service worker) para o marco 4.
- [ ] **Step 3:** Garantir que a chave não ficou em nenhum arquivo (`git grep -n "sk-ant"` sem resultados). Commit `docs: resultado do teste de acesso direto ao Anthropic`.

---

## Marco 1 — Backup e restauração

### Task 4: Snapshot e exportação (JSON e HTML)

**Files:**
- Create: `src/core/snapshot.ts`
- Modify: `src/core/types.ts` (adiciona `Snapshot`)
- Test: `tests/core/snapshot.test.ts`

**Interfaces:**
- Consumes: `BmNode`.
- Produces:

```ts
export interface Snapshot { id: string; createdAt: number; reason: string; tree: BmNode[] }
export function createSnapshot(tree: BmNode[], reason: string, now: number): Snapshot  // id = `${now}-${contador curto}` único
export function snapshotToJson(s: Snapshot): string          // JSON.stringify com indentação 2
export function snapshotToNetscapeHtml(s: Snapshot): string  // <!DOCTYPE NETSCAPE-Bookmark-file-1>, <DL><p>, <DT><H3>pasta</H3>, <DT><A HREF ADD_DATE>
```

- [ ] **Step 1: Escrever os testes:**

```ts
it('snapshotToJson ida e volta preserva a árvore', () => {
  const s = createSnapshot(sampleTree, 'manual', 1_700_000_000_000)
  expect(JSON.parse(snapshotToJson(s)).tree).toEqual(sampleTree)
})
it('snapshotToNetscapeHtml escapa & < > " no título e na URL', () => {
  const html = snapshotToNetscapeHtml(createSnapshot(treeWithLink('A & B <x>', 'https://a.com/?q=1&r="2"'), 'manual', 0))
  expect(html).toContain('A &amp; B &lt;x&gt;')
  expect(html).toContain('HREF="https://a.com/?q=1&amp;r=&quot;2&quot;"')
})
it('ADD_DATE sai em segundos, não em milissegundos', () => {
  expect(snapshotToNetscapeHtml(createSnapshot(treeWithLinkAdded(1_700_000_000_000), 'm', 0))).toContain('ADD_DATE="1700000000"')
})
it('dois snapshots no mesmo instante têm ids diferentes', () => {
  expect(createSnapshot([], 'a', 5).id).not.toBe(createSnapshot([], 'a', 5).id)
})
```

- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5: Commit** `feat: snapshot e exportação em JSON e HTML`.

### Task 5: Armazenamento de snapshots (IndexedDB, últimos 20)

**Files:**
- Create: `src/storage/db.ts`, `src/storage/snapshots.ts`
- Test: `tests/storage/snapshots.test.ts` (usa `fake-indexeddb/auto`)

**Interfaces:**
- Consumes: `Snapshot`.
- Produces: `openDb(): Promise<IDBPDatabase>` (banco `organizar-favoritos`, stores `snapshots` com chave `id` e índice `createdAt`, e `journal` com chave `planId`); `saveSnapshot(s: Snapshot): Promise<void>`; `listSnapshots(): Promise<Snapshot[]>` (mais novo primeiro); `getSnapshot(id: string): Promise<Snapshot | undefined>`; `pruneSnapshots(max = 20): Promise<void>`. `saveSnapshot` chama `pruneSnapshots` ao final.

- [ ] **Step 1: Testes:**

```ts
it('guarda e lista do mais novo para o mais antigo', async () => { /* salva t=1,2,3 */ expect((await listSnapshots()).map(s => s.createdAt)).toEqual([3, 2, 1]) })
it('mantém só os últimos 20', async () => { /* salva 25 */ expect(await listSnapshots()).toHaveLength(20); /* o mais antigo some */ })
it('getSnapshot devolve undefined para id inexistente', async () => { expect(await getSnapshot('nao-existe')).toBeUndefined() })
```

- [ ] **Step 2–4:** FAIL → implementar com `idb` → PASS. **Step 5: Commit** `feat: armazenamento de snapshots com limite de 20`.

### Task 6: Planos, execução com backup prévio, diário e desfazer

**Files:**
- Create: `src/core/plan.ts`, `src/storage/journal.ts`
- Modify: `src/core/types.ts` (adiciona `Operation`, `Plan`, `JournalEntry`)
- Test: `tests/core/plan.test.ts` (com um `BookmarksApi` falso em memória e `fake-indexeddb`)

**Interfaces:**
- Consumes: `BookmarksApi`, `createSnapshot`, `saveSnapshot`.
- Produces (tipos):

```ts
export type Operation =
  | { op: 'create-folder'; tempId: string; parentId: string; title: string }   // parentId pode ser um tempId
  | { op: 'create-link'; parentId: string; title: string; url: string }
  | { op: 'move'; id: string; toParentId: string; toIndex?: number }
  | { op: 'remove'; id: string }                                              // só usado por esvaziar a Lixeira
export interface Plan { id: string; label: string; operations: Operation[] }
export interface JournalEntry { planId: string; label: string; appliedAt: number; snapshotId: string; inverse: Operation[] }
```

- Produces (funções): `runPlan(plan: Plan, api: BookmarksApi, now: number): Promise<{ applied: number; failed: { op: Operation; error: string }[]; entry: JournalEntry }>`; `undoLast(api: BookmarksApi): Promise<{ undone: number; skipped: number } | null>` (null se não houver diário); `class BackupFailedError extends Error`. `saveEntry/lastEntry/deleteEntry` em `storage/journal.ts`.
- Regras de `runPlan`: (1) lê a árvore, grava snapshot com `reason = plan.label`; se falhar, lança `BackupFailedError` **antes de qualquer operação**; (2) aplica as operações em ordem, resolvendo `tempId` para o id real criado; (3) recusa (como falha) qualquer operação sobre nó protegido; (4) uma falha isolada (id inexistente) não interrompe as demais; (5) o `inverse` contém só o que foi aplicado: `move` volta ao pai/índice originais (lidos com `api.get` antes de mover), `create-folder`/`create-link` viram `remove`; `remove` não tem inverso. (6) `undoLast` aplica o `inverse` em ordem reversa, pula `remove` de pasta que ficou com filhos, apaga a entrada do diário.

- [ ] **Step 1: Testes** (falso em memória cria 3 favoritos em 2 pastas):

```ts
it('grava o snapshot antes de mudar qualquer coisa', async () => { /* spy: ordem saveSnapshot < api.move */ })
it('se o backup falha, lança BackupFailedError e não aplica nada', async () => {
  await expect(runPlan(plan, api, 0)).rejects.toBeInstanceOf(BackupFailedError)
  expect(api.calls).toEqual([])           // nenhuma operação executada
})
it('resolve tempId de uma pasta nova para mover um link para dentro dela', async () => { /* create-folder 't1' + move para 't1' */ })
it('operação sobre id inexistente falha sozinha e as outras seguem', async () => {
  const r = await runPlan(planWithOneBadId, api, 0)
  expect(r.failed).toHaveLength(1); expect(r.applied).toBe(1)
})
it('recusa mover uma pasta raiz', async () => { /* move id '1' → falha 'protegido' */ })
it('undoLast devolve cada link ao pai e ao índice originais', async () => { /* run + undo → árvore igual à inicial */ })
it('undoLast só desfaz o que foi aplicado quando houve falha parcial', async () => {})
it('undoLast devolve null sem diário', async () => { expect(await undoLast(api)).toBeNull() })
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: execução de planos com backup prévio, diário e desfazer`.

### Task 7: Planos de restauração

**Files:**
- Create: `src/core/restore.ts`
- Test: `tests/core/restore.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `BmNode`, `Plan`, `otherBookmarksId`, `findNode`.
- Produces: `planRestoreAll(snapshot: Snapshot, current: BmNode[], now: Date): Plan` — cria `Restaurado em YYYY-MM-DD HH:mm` (horário local) dentro de `otherBookmarksId(current)` e recria ali a árvore inteira do snapshot (sem as pastas raiz); `planRestoreItem(snapshot: Snapshot, nodeId: string, current: BmNode[], now: Date): Plan` — se o nó ainda existe na árvore atual (ex.: está na Lixeira) e o pai original existe, `move` de volta ao pai original; se não existe mais, recria (link ou pasta com filhos) no pai original quando ele existe, senão dentro de uma pasta `Restaurados` criada em `otherBookmarksId(current)`.

- [ ] **Step 1: Testes:**

```ts
it('restaurar tudo nunca toca em favoritos existentes: só create-folder e create-link', () => {
  const p = planRestoreAll(snap, current, new Date(2026, 9, 29, 15, 7))
  expect(p.operations.every(o => o.op === 'create-folder' || o.op === 'create-link')).toBe(true)
  expect(p.operations[0]).toMatchObject({ op: 'create-folder', title: 'Restaurado em 2026-10-29 15:07' })
})
it('restaurar um item que está na Lixeira move de volta ao pai original', () => {
  expect(planRestoreItem(snap, '10', currentWith10InTrash, now).operations).toEqual([{ op: 'move', id: '10', toParentId: '5' }])
})
it('restaurar um item apagado cujo pai também sumiu cai na pasta Restaurados', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: planos de restauração total e por item`.

### Task 8: Interface de backups e atalho no popup

**Files:**
- Create: `src/ui/BackupsTab.tsx`, `src/ui/useBookmarks.ts` (carrega a árvore e recarrega após aplicar)
- Modify: `src/entrypoints/dashboard/App.tsx`, `src/entrypoints/popup/main.tsx`

**Interfaces:**
- Consumes: `createSnapshot`, `saveSnapshot`, `listSnapshots`, `snapshotToJson`, `snapshotToNetscapeHtml`, `planRestoreAll`, `planRestoreItem`, `runPlan`, `chromeBookmarksApi`.
- Produces: aba **Backups** com botão "Fazer backup agora", lista dos snapshots (data, motivo, total de links), "Exportar JSON", "Exportar HTML" (download via `Blob`), "Restaurar tudo" e, ao expandir um snapshot, "Restaurar este item/pasta". Restaurar mostra a pré-visualização do plano (quantas pastas e links serão criados) e pede confirmação. O botão do popup passa a fazer o backup manual e mostra "Backup feito" ou o erro.

- [ ] **Step 1:** Implementar a aba e o popup.
- [ ] **Step 2: `npm run compile` e `npm test`** → sem erros.
- [ ] **Step 3: Verificação manual no Chrome** (anotar o resultado no commit): fazer backup → aparece na lista; exportar o HTML e **importá-lo em um perfil limpo do Chrome** (`chrome://bookmarks` → Organizar → Importar) → a árvore bate; restaurar tudo → surge a pasta `Restaurado em ...` e nada mais muda.
- [ ] **Step 4: Commit** `feat: aba de backups, exportação, restauração e atalho no popup`.

---

## Marco 2 — Limpeza

### Task 9: Normalização de URL e duplicados

**Files:**
- Create: `src/core/url.ts`, `src/core/duplicates.ts`
- Test: `tests/core/url.test.ts`, `tests/core/duplicates.test.ts`

**Interfaces:**
- Produces: `normalizeUrl(url: string): string | null` (null para URL inválida ou que não seja `http`/`https`); `isCheckableUrl(url: string): boolean` (http/https e host não local: não `localhost`, `*.local`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `[::1]`); `findDuplicates(links: FlatLink[]): { keep: FlatLink; extras: FlatLink[] }[]`.
- Regras de normalização: esquema e host em minúsculas; remove `#fragmento`; remove parâmetros `utm_*`, `fbclid`, `gclid`; ordena os parâmetros restantes; remove a barra final do caminho (inclusive a raiz). Em `findDuplicates` fica o de **menor `dateAdded`**; empate → o de caminho mais profundo; grupos de um item só não aparecem.

- [ ] **Step 1: Testes:**

```ts
expect(normalizeUrl('HTTPS://Example.com/a/?utm_source=x&b=2&a=1#top')).toBe('https://example.com/a?a=1&b=2')
expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
expect(normalizeUrl('javascript:alert(1)')).toBeNull()
expect(normalizeUrl('chrome://settings')).toBeNull()
expect(isCheckableUrl('http://192.168.0.10/x')).toBe(false)
expect(isCheckableUrl('https://exemplo.com.br')).toBe(true)
// findDuplicates
it('mantém o mais antigo e lista os extras', () => {})
it('favoritelets e URLs não web nunca entram em grupos de duplicados', () => {})
it('mesma URL só com utm_source diferente conta como duplicada', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar (usar `URL`) → PASS. **Step 5: Commit** `feat: normalização de URL e detecção de duplicados`.

### Task 10: Favoritos sem uso

**Files:**
- Create: `src/core/inactive.ts`
- Test: `tests/core/inactive.test.ts`

**Interfaces:**
- Produces: `findInactive(links: FlatLink[], now: number, thresholdDays = 365): { link: FlatLink; reason: 'sem-uso' | 'sem-registro'; lastTouch: number }[]`. Referência de tempo = `dateLastUsed` se for um número maior que 0, senão `dateAdded` (motivo `sem-registro`). Entra se `now - referência > thresholdDays * 86_400_000`. Ordena do mais antigo para o mais recente. Ignora URLs não web.

- [ ] **Step 1: Testes:**

```ts
it('usa dateLastUsed quando existe', () => {})
it('dateLastUsed = 0 conta como ausente e cai para dateAdded com motivo sem-registro', () => {})
it('um favorito adicionado há 10 dias e nunca aberto não é sem uso', () => {})
it('respeita o limiar ajustável: 30 dias', () => {})
it('o limite é exclusivo: exatamente 365 dias não entra', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: detecção de favoritos sem uso`.

### Task 11: Verificação de links

**Files:**
- Create: `src/core/linkStatus.ts`, `src/chrome/permissions.ts`
- Test: `tests/core/linkStatus.test.ts`

**Interfaces:**
- Produces:

```ts
export type LinkStatus = 'ok' | 'quebrado' | 'incerto'
export function classifyStatus(httpStatus: number): LinkStatus      // 404|410 → quebrado; 200–399 → ok; resto → incerto
export interface CheckOptions { concurrency?: number /*10*/; timeoutMs?: number /*10000*/; fetchFn?: typeof fetch; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }
export function checkLinks(urls: string[], opts?: CheckOptions): Promise<Map<string, LinkStatus>>
// chrome/permissions.ts
export function requestLinkCheckPermission(): Promise<boolean>     // chrome.permissions.request({ origins: ['<all_urls>'] }); precisa de gesto do usuário
```

- Regras de `checkLinks`: URLs não verificáveis (`isCheckableUrl` falso) ficam **de fora** do mapa; tenta `HEAD` e, se o resultado não for `ok`, repete com `GET` e classifica o resultado do `GET`; erro de rede ou timeout → `incerto`; no máximo `concurrency` requisições simultâneas; `signal` cancela e devolve o que já foi feito. Roda na **página do painel** (não no service worker, que o Chrome pode encerrar no meio da varredura).

- [ ] **Step 1: Testes** (com `fetchFn` falso):

```ts
expect(classifyStatus(404)).toBe('quebrado'); expect(classifyStatus(410)).toBe('quebrado')
expect(classifyStatus(200)).toBe('ok'); expect(classifyStatus(301)).toBe('ok')
expect(classifyStatus(403)).toBe('incerto'); expect(classifyStatus(429)).toBe('incerto'); expect(classifyStatus(503)).toBe('incerto')
it('HEAD 404 mas GET 200: fica ok', async () => {})
it('HEAD 404 e GET 404: fica quebrado', async () => {})
it('erro de rede e timeout viram incerto, nunca quebrado', async () => {})
it('nunca passa de `concurrency` requisições ao mesmo tempo (500 URLs, limite 10)', async () => { /* fetch falso mede o pico */ expect(peak).toBeLessThanOrEqual(10) })
it('URLs locais e não web não são buscadas nem aparecem no resultado', async () => {})
it('abort interrompe e devolve o parcial', async () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: verificação de links com estado incerto`.

### Task 12: Plano de limpeza e Lixeira

**Files:**
- Create: `src/core/cleanup.ts`
- Test: `tests/core/cleanup.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Operation`, `otherBookmarksId`, `isProtected`.
- Produces: `export const TRASH_TITLE = 'Lixeira (Organizar Favoritos)'`; `findTrash(root: BmNode[]): BmFolder | undefined` (por título, em `Outros favoritos`); `buildCleanupPlan(root: BmNode[], linkIds: string[], label: string): Plan` — move os links para a Lixeira, criando-a (`create-folder` com `tempId`) se não existir; nunca inclui ids protegidos nem pastas; ids inexistentes são ignorados; `buildPurgePlan(root: BmNode[]): Plan` — uma operação `remove` para a Lixeira inteira (vazio se não existir); `findEmptyFolders(root: BmNode[]): BmFolder[]` (pastas sem links em nenhum nível, exceto raízes e a Lixeira).

- [ ] **Step 1: Testes:**

```ts
it('cria a Lixeira em Outros favoritos quando não existe', () => {
  const p = buildCleanupPlan(tree, ['10'], 'Limpeza')
  expect(p.operations[0]).toMatchObject({ op: 'create-folder', title: TRASH_TITLE, parentId: '2' })
})
it('reutiliza a Lixeira existente em vez de criar outra', () => {})
it('nunca move ids de pastas ou pastas raiz', () => {})
it('findEmptyFolders considera vazia a pasta que só tem subpastas vazias', () => {})
it('findEmptyFolders ignora a Lixeira e as pastas raiz', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: plano de limpeza com Lixeira`.

### Task 13: Interface de limpeza (revisão, aplicar, desfazer, esvaziar Lixeira)

**Files:**
- Create: `src/ui/CleanupTab.tsx`, `src/ui/LinkReviewList.tsx`
- Modify: `src/entrypoints/dashboard/App.tsx`
- Test: `tests/ui/selection.test.ts` (lógica de seleção extraída em função pura em `src/ui/selection.ts`)

**Interfaces:**
- Consumes: `findInactive`, `findDuplicates`, `checkLinks`, `requestLinkCheckPermission`, `findEmptyFolders`, `buildCleanupPlan`, `buildPurgePlan`, `runPlan`, `undoLast`, `BackupFailedError`.
- Produces: `toggleOne(sel: Set<string>, id: string): Set<string>`, `selectAll(ids: string[]): Set<string>`, `clear(): Set<string>`, `filterByReason(items, reason)` em `selection.ts`; a aba **Limpeza** com: botões "Analisar sem uso", "Achar duplicados", "Testar links" (pede a permissão ao clicar; mostra progresso e botão cancelar); lista com filtro por motivo (`sem-uso`, `sem-registro`, `duplicado`, `quebrado`, `incerto`), seleção individual e em massa, "abrir link" antes de decidir; resumo do plano ("Mover N favoritos para a Lixeira") e confirmação; depois de aplicar, faixa "Desfazer" (chama `undoLast`) e o relato de falhas parciais; botão "Esvaziar Lixeira" separado, com confirmação explícita que avisa que a ação não é desfeita pelo "Desfazer" (o backup continua disponível). `incerto` aparece com aviso e começa **desmarcado**. A lista renderiza em janelas (virtualização simples ou paginação de 200) para coleções grandes.

- [ ] **Step 1: Testes da seleção:**

```ts
it('toggleOne adiciona e remove sem mutar o conjunto original', () => {})
it('selectAll de uma lista filtrada não seleciona itens fora do filtro', () => {})
it('itens incerto começam desmarcados mesmo com "selecionar todos os quebrados"', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar `selection.ts` e a aba → PASS; `npm run compile` sem erros.
- [ ] **Step 5: Verificação manual no Chrome com a coleção real**, nesta ordem, anotando o resultado:
  1. Analisar sem uso → conferir 3 itens conhecidos.
  2. Mover 5 itens para a Lixeira → backup criado, itens na Lixeira, **Desfazer** devolve cada um ao lugar de origem.
  3. Testar links numa pasta pequena → quebrados e incertos aparecem separados; conferir manualmente 3 "quebrados" no navegador.
  4. Apagar um favorito pelo Chrome e tentar aplicar um plano que o inclui → falha parcial é relatada e o resto aplica.
  5. Esvaziar Lixeira → pasta some; restaurar o item pelo backup funciona.
- [ ] **Step 6: Commit** `feat: aba de limpeza com revisão, Lixeira e desfazer`.

---

## Self-Review

- **Cobertura do design:** §5.1 → Tasks 6 e 13; §5.2 → Tasks 9, 10, 11, 12, 13; §5.3 → Tasks 4, 5, 6, 7, 8; §5.6 → Task 1; §6 → File Structure; marco 0 → Tasks 1–3. **Fora deste plano:** §5.4 (organização) e §5.5 (IA), marcos 3–5. **Desvios do design:** a verificação de links roda na página do painel e não no service worker, e não há service worker (nada precisa dele). `PLANO.md` foi atualizado de acordo.
- **Consistência de tipos:** `BookmarksApi`, `Operation`, `Plan`, `Snapshot` e `FlatLink` têm uma única definição (Tasks 2, 4 e 6) e são usados com os mesmos nomes nas Tasks 7, 8, 12 e 13. `otherBookmarksId` (Task 2) é usado nas Tasks 7 e 12.
- **Review Focus:** itens 1–5 têm teste nas Tasks 9–13 e 6, indicadas acima.
- **Proporção:** o plano contém assinaturas, regras e asserções; os corpos ficam para quem implementa.
