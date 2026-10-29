# Novo painel (dashboard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a interface atual por um painel escuro com barra lateral de pastas, resumo clicável, lista densa, mover por arrastar ou por menu com Desfazer, paleta Ctrl K e tema Claro/Escuro/Sistema.

**Architecture:** A lógica nova é pura e testável (`src/core/`, `src/ui/theme/`), e a tela é uma casca (`Shell`) com barra lateral, topo e uma vista por rota. Toda mudança de favoritos continua passando por `runPlan` (backup → aplicar → diário); mover favoritos usa um backup compartilhado por janela de 10 minutos. Os módulos de `src/core/` existentes (planos, desfazer, limpeza, restauração) são reaproveitados.

**Tech Stack:** React + TypeScript + WXT (já no projeto), Vitest. **Sem dependências novas.**

**Spec:** `docs/superpowers/specs/2026-10-29-novo-painel-design.md` (layout aprovado no mockup v3).

## Global Constraints

- React + TypeScript, Manifest V3, só Chrome. CSS próprio, sem biblioteca de UI e **sem dependência nova**. Arrastar com a API nativa de arrastar-e-soltar.
- Tema: `'light' | 'dark' | 'system'`, padrão **`'dark'`**, guardado em `localStorage` sob a chave `theme`. Tokens em TypeScript; todo par de texto/fundo usado precisa de contraste **≥ 4,5:1** nos dois temas, conferido por teste.
- Toda mudança de favoritos passa por `runPlan`; o desfazer (`undoLast`) desfaz o plano mais recente.
- Backup: planos de "mover favoritos" compartilham um backup automático dentro de **10 minutos** (`BACKUP_WINDOW_MS = 600_000`); limpeza, esvaziar a Lixeira e restauração **sempre** fazem backup novo. Backups `manual` nunca são apagados automaticamente; os `auto` ficam limitados aos **últimos 20**. Snapshot sem `kind` conta como `auto`.
- Aviso de desfazer: **10 s**, fica enquanto o mouse está sobre ele. `Esc` cancela um arraste.
- Só **links** são arrastáveis. Pastas raiz (filhas diretas da raiz) nunca são movidas.
- Lista paginada de **200** em **200** (sem virtualização). Atalho da paleta: `Ctrl+K` (e `Cmd+K`).
- Interface em português. Commits em português: `feat:`, `test:`, `chore:`, `docs:`. Os testes existentes (112) continuam passando em toda tarefa.
- "Sem categoria" = links que estão **direto** em Barra de favoritos, Outros favoritos ou Mobile, fora da Lixeira e de qualquer subpasta.

## Review Focus

1. **Soltar na pasta onde já está**, na Lixeira ou numa pasta raiz, e arrastar um item que não está na seleção: não pode gerar plano com ops inválidas nem mover a seleção errada. → Tasks 4 e 6.
2. **Dois arrastes seguidos e Desfazer:** o segundo reaproveita o backup do primeiro e o Desfazer desfaz o mais recente; um arraste depois dos 10 minutos gera backup novo. → Task 3.
3. **Favorito que sumiu ou mudou fora do painel** entre selecionar e soltar: falha só aquele item e o resto segue. → Task 4.
4. **`localStorage` indisponível ou tema salvo inválido** e `matchMedia` ausente: cai para Escuro sem quebrar. → Task 1.
5. **Pasta com milhares de links e árvore com centenas de pastas, pastas com nomes iguais ou título vazio:** nada trava e a interface continua utilizável. → Tasks 2 e 5.

---

## File Structure

```
src/
  core/
    folders.ts        # buildFolderTree, sidebarFolders, directLinks, uncategorizedLinks
    moves.ts          # planMoveLinks
    dragPayload.ts    # DRAG_MIME, encodeDrag, decodeDrag, idsToDrag
    backupPolicy.ts   # BACKUP_WINDOW_MS, canShareBackup
    palette.ts        # searchPalette, normalizeText
    overview.ts       # computeOverview
    route.ts          # View (rotas do painel)
  ui/
    theme/{tokens.ts,theme.ts,ThemeToggle.tsx,init.ts}
    layout/{Shell.tsx,Sidebar.tsx,Topbar.tsx}
    views/{OverviewView.tsx,FolderView.tsx,CleanupView.tsx,BackupsView.tsx,TrashView.tsx}
    components/{LinkList.tsx,SelectionBar.tsx,Toast.tsx,MovePicker.tsx,CommandPalette.tsx}
    state/useLibrary.ts   # árvore, recarregar, mover, desfazer
    styles.css            # só var(--token); sem cores fixas
  entrypoints/dashboard/{index.html,main.tsx,App.tsx}   # App passa a só montar o Shell
```

`OverviewTab.tsx`, `CleanupTab.tsx` e `BackupsTab.tsx` atuais viram as vistas correspondentes (mantendo a lógica, trocando o markup e o CSS).

---

### Task 1: Tokens e tema Claro/Escuro/Sistema

**Files:**
- Create: `src/ui/theme/tokens.ts`, `src/ui/theme/theme.ts`, `src/ui/theme/ThemeToggle.tsx`, `src/ui/theme/init.ts`
- Modify: `src/entrypoints/dashboard/index.html` (carrega `init.ts` antes do `main.tsx`), `src/entrypoints/dashboard/style.css` (passa a usar `var(--...)`)
- Test: `tests/ui/theme.test.ts`, `tests/ui/contrast.test.ts`

**Interfaces:**
- Produces:

```ts
// tokens.ts
export interface Tokens { bg; sidebar; surface; raised; border; text; textSecondary; textTertiary; primary; primaryText; link; warnBg; warnText; dangerBg; dangerText; okBg; okText: string }
export const darkTokens: Tokens   // valores do design §6
export const lightTokens: Tokens
export function contrastRatio(fg: string, bg: string): number    // WCAG, "#rrggbb"
// theme.ts
export type ThemePref = 'light' | 'dark' | 'system'
export function parsePref(raw: unknown): ThemePref                          // inválido → 'dark'
export function resolveTheme(pref: ThemePref, systemPrefersDark: boolean): 'light' | 'dark'
export function loadPref(storage?: Pick<Storage,'getItem'>): ThemePref       // erro ao ler → 'dark'
export function savePref(pref: ThemePref, storage?: Pick<Storage,'setItem'>): void   // erro ao gravar é engolido
export function applyTheme(resolved: 'light'|'dark', doc?: Document): void   // define --tokens, data-theme e color-scheme
```

- [ ] **Step 1: Testes de tema**

```ts
it('parsePref aceita light/dark/system e cai para dark em qualquer outra coisa', () => {
  expect(parsePref('light')).toBe('light'); expect(parsePref('system')).toBe('system')
  expect(parsePref('azul')).toBe('dark'); expect(parsePref(null)).toBe('dark'); expect(parsePref(undefined)).toBe('dark')
})
it('resolveTheme: system segue o sistema, o resto é fixo', () => {
  expect(resolveTheme('system', true)).toBe('dark'); expect(resolveTheme('system', false)).toBe('light')
  expect(resolveTheme('light', true)).toBe('light'); expect(resolveTheme('dark', false)).toBe('dark')
})
it('loadPref devolve dark se o storage lança erro; savePref não lança', () => {
  const broken = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') } }
  expect(loadPref(broken)).toBe('dark'); expect(() => savePref('light', broken)).not.toThrow()
})
```

- [ ] **Step 2: Teste de contraste** (os dois temas, cada par que a interface usa)

```ts
const pairs = (t: Tokens): [string, string, string][] => [
  [t.text, t.bg, 'texto/base'], [t.text, t.surface, 'texto/superfície'],
  [t.textSecondary, t.surface, 'secundário/superfície'], [t.textTertiary, t.surface, 'terciário/superfície'],
  [t.textTertiary, t.bg, 'terciário/base'], [t.textTertiary, t.sidebar, 'terciário/lateral'],
  [t.primaryText, t.primary, 'botão primário'], [t.link, t.surface, 'link/superfície'],
  [t.warnText, t.warnBg, 'aviso'], [t.dangerText, t.dangerBg, 'perigo'], [t.okText, t.okBg, 'ok'],
]
for (const [name, t] of [['escuro', darkTokens], ['claro', lightTokens]] as const)
  it(`todos os pares do tema ${name} têm contraste ≥ 4,5`, () => {
    for (const [fg, bg, label] of pairs(t)) expect(contrastRatio(fg, bg), label).toBeGreaterThanOrEqual(4.5)
  })
it('contrastRatio: preto sobre branco é 21', () => expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1))
```

- [ ] **Step 3: Rodar** `npx vitest run tests/ui/theme.test.ts tests/ui/contrast.test.ts` → FAIL.
- [ ] **Step 4: Implementar** `tokens.ts` (escuro com os valores do design §6; claro: ponto de partida `bg #f6f7f9`, `sidebar/surface #ffffff`, `raised #eef1f6`, `border #dde1e8`, `text #1f2328`, `textSecondary #4b5565`, `textTertiary #5f6b7a`, `primary #3f5fd0` com texto branco; ajustar até o teste passar), `theme.ts` e `init.ts` (lê a preferência, resolve com `matchMedia` quando existir, chama `applyTheme` e, se a preferência for `system`, escuta mudanças do sistema). `ThemeToggle.tsx` mostra ☀ ◐ ☾, grava com `savePref` e reaplica.
- [ ] **Step 5:** `npm test` → tudo verde; `npm run compile` limpo; `npm run build` ok. Verificação manual: o painel abre escuro sem piscar branco; o seletor troca os temas.
- [ ] **Step 6: Commit** `feat: tokens e tema claro, escuro e sistema`.

### Task 2: Árvore de pastas e listagens

**Files:**
- Create: `src/core/folders.ts`, `src/core/route.ts`
- Test: `tests/core/folders.test.ts`

**Interfaces:**
- Consumes: `BmNode`, `BmLink`, `FlatLink`, `findTrash`, `isProtected`.
- Produces:

```ts
export interface FolderNode { id: string; title: string; count: number; children: FolderNode[] }   // count = links na subárvore
export function buildFolderTree(root: BmNode[]): FolderNode[]           // filhas diretas da raiz como topo, com contagens recursivas
export function sidebarFolders(root: BmNode[]): FolderNode[]             // subpastas de Barra, Outros e Mobile, sem a Lixeira, em ordem
export function directLinks(root: BmNode[], folderId: string): BmLink[]  // só filhos diretos que são links, na ordem da pasta
export function uncategorizedLinks(root: BmNode[]): BmLink[]             // links direto nas 3 raiz, fora da Lixeira
// route.ts
export type View =
  | { name: 'overview' } | { name: 'folder'; id: string }
  | { name: 'cleanup'; start?: 'sem-uso' | 'duplicado' | 'quebrado' }
  | { name: 'backups' } | { name: 'trash' }
```

- [ ] **Step 1: Testes** (árvore: Barra com `Trabalho > Ferramentas` e `Estudos`, link solto na Barra, Outros com Lixeira contendo um link):

```ts
it('contagem de uma pasta soma a subárvore', () => expect(count('Trabalho')).toBe(3))
it('sidebarFolders junta as subpastas das três raiz e deixa a Lixeira de fora', () => {})
it('uncategorizedLinks pega só links direto nas raiz e ignora os da Lixeira e os de subpastas', () => {})
it('directLinks devolve só links diretos, não os de subpastas', () => {})
it('pastas com o mesmo nome ou título vazio têm ids distintos e não se misturam', () => {})
it('uma raiz sem filhos e uma pasta sem links têm count 0', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS. **Step 5: Commit** `feat: árvore de pastas com contagens`.

### Task 3: Política de backup compartilhado

**Files:**
- Modify: `src/core/types.ts` (`Snapshot.kind?: 'auto' | 'manual'`), `src/core/snapshot.ts` (`createSnapshot(tree, reason, now, kind = 'auto')`), `src/storage/snapshots.ts`, `src/core/plan.ts`, `src/ui/backupActions.ts` (usa `'manual'`)
- Create: `src/core/backupPolicy.ts`
- Test: `tests/core/backupPolicy.test.ts`, `tests/storage/snapshots.test.ts`, `tests/core/plan.test.ts`

**Interfaces:**
- Produces: `BACKUP_WINDOW_MS = 600_000`; `canShareBackup(last: Snapshot | undefined, now: number): boolean` (verdadeiro se `last` é `auto` e `now - last.createdAt < BACKUP_WINDOW_MS`); `latestAutoSnapshot(): Promise<Snapshot | undefined>` em `storage/snapshots.ts`; `runPlan(plan, api, now, store?, opts?: { shareBackup?: boolean })` e `RunStore.latestAutoSnapshot()`.
- Regras: `pruneSnapshots` só remove `auto` além de `MAX_SNAPSHOTS`; `manual` nunca. Com `shareBackup` e janela aberta, `runPlan` reaproveita `snapshotId` sem criar outro; se o backup novo falhar, continua a lançar `BackupFailedError` antes de qualquer mudança.

- [ ] **Step 1: Testes**

```ts
it('canShareBackup: auto de 9 min atrás compartilha, de 10 min exatos não, manual nunca', () => {})
it('prune remove só auto além de 20 e mantém todos os manuais', async () => { /* 25 auto + 3 manuais → 20 auto + 3 manuais */ })
it('snapshot antigo sem kind conta como auto', async () => {})
it('dois planos com shareBackup dentro da janela geram um snapshot só e o mesmo snapshotId no diário', async () => {})
it('depois da janela, shareBackup gera um novo snapshot', async () => {})
it('sem shareBackup (limpeza, restauração), sempre faz backup novo mesmo dentro da janela', async () => {})
it('com shareBackup e falha ao criar o snapshot novo, lança BackupFailedError e não aplica nada', async () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS (os testes antigos de `runPlan` seguem verdes).
- [ ] **Step 5: Commit** `feat: backup automático compartilhado por janela de 10 minutos`.

### Task 4: Mover favoritos (plano, estado e aviso com Desfazer)

**Files:**
- Create: `src/core/moves.ts`, `src/ui/state/useLibrary.ts`, `src/ui/components/Toast.tsx`
- Test: `tests/core/moves.test.ts`, `tests/ui/library.test.ts` (lógica de `moveLinks` com o `makeFakeApi`)

**Interfaces:**
- Consumes: `Plan`, `runPlan` (com `shareBackup`), `undoLast`, `BookmarksApi`.
- Produces:

```ts
export function planMoveLinks(root: BmNode[], linkIds: string[], targetFolderId: string): Plan
// ignora ids que não são links, repetidos, já no destino; destino inexistente ou que não é pasta → plano vazio
export async function moveLinks(api: BookmarksApi, linkIds: string[], targetFolderId: string, now: number):
  Promise<{ moved: number; failed: number; targetTitle: string }>
// lê a árvore de agora, monta o plano, roda com { shareBackup: true }
// useLibrary(): { tree, reload, move(ids, folderId), undo(), lastInfo, toast }
```

- [ ] **Step 1: Testes**

```ts
it('planMoveLinks gera um move por link, na ordem recebida', () => {})
it('ignora link que já está no destino, ids repetidos, ids de pastas e ids que não existem', () => {})
it('soltar na pasta de origem não gera operações', () => {})
it('o destino pode ser uma pasta raiz ou a Lixeira (continua sendo uma pasta válida)', () => {})
it('destino que não existe ou é um link devolve plano vazio', () => {})
it('moveLinks usa a árvore de agora: um link apagado fora do painel falha sozinho e os outros movem', async () => {
  // r.moved === 2, r.failed === 1
})
it('moveLinks seguido de undoLast devolve tudo ao lugar', async () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `Toast.tsx`: mensagem + botão "Desfazer" + ✕; 10 s; pausa o tempo com o mouse em cima; `role="status"` e `aria-live="polite"`. Verificação por compile/build.
- [ ] **Step 6: Commit** `feat: mover favoritos com aviso e desfazer`.

### Task 5: Vista de pasta e lista com três modos

**Files:**
- Create: `src/ui/components/LinkList.tsx`, `src/ui/views/FolderView.tsx`, `src/ui/views/TrashView.tsx`, `src/ui/layout/Shell.tsx`, `src/ui/layout/Sidebar.tsx`, `src/ui/layout/Topbar.tsx`
- Modify: `src/entrypoints/dashboard/App.tsx` (monta `Shell` com `useLibrary`), `src/entrypoints/dashboard/style.css` → `src/ui/styles.css`
- Test: `tests/core/folders.test.ts` (paginação/ordenação se virar função pura: `pageOf<T>(items: T[], shown: number, size = 200): T[]`)

**Interfaces:**
- Consumes: `buildFolderTree`, `sidebarFolders`, `directLinks`, `uncategorizedLinks`, `searchLinks`, `useLibrary`, `View`.
- Produces: modo de visualização `'lista' | 'cards' | 'compacto'` guardado em `localStorage` (`viewMode`, padrão `'lista'`); `Shell` com rota em estado (`View`); breadcrumb no topo; árvore recolhível (estado de abertas/fechadas em memória).

- [ ] **Step 1: Teste** de `pageOf` (200 itens por página, nunca passa do total) e de que `directLinks` de uma pasta com 5.000 links devolve em ordem sem lançar.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Interface.** `Shell` = `Sidebar` + `Topbar` + vista da rota; `FolderView` mostra os links diretos da pasta (e subpastas como atalhos no topo), com busca local e os três modos; "Sem categoria" usa `uncategorizedLinks`; `TrashView` lista a Lixeira com "Esvaziar a Lixeira…" (reaproveita `preparePurge`). Etiquetas "sem uso / duplicado / quebrado" aparecem na lista quando houver análise em memória.
- [ ] **Step 6: Verificação manual:** navegar por 3 pastas, recolher/expandir a árvore, alternar os três modos (o escolhido persiste), abrir a pasta maior e conferir que a rolagem não trava.
- [ ] **Step 7: Commit** `feat: casca do painel, árvore de pastas e lista em três modos`.

### Task 6: Seleção, "Mover para…" e arrastar e soltar

**Files:**
- Create: `src/core/dragPayload.ts`, `src/ui/components/SelectionBar.tsx`, `src/ui/components/MovePicker.tsx`
- Modify: `src/ui/layout/Sidebar.tsx` (alvos de soltura), `src/ui/components/LinkList.tsx` (alça arrastável e caixa de seleção), `src/ui/layout/Shell.tsx` (barra de seleção e aviso)
- Test: `tests/core/dragPayload.test.ts`

**Interfaces:**
- Produces:

```ts
export const DRAG_MIME = 'application/x-organizar-favoritos'
export function encodeDrag(ids: string[]): string
export function decodeDrag(data: string): string[]       // JSON inválido, não-array ou itens que não são string → []
export function idsToDrag(draggedId: string, selected: Set<string>): string[]
// se draggedId está em selected → todos de selected (ordem estável); senão [draggedId]
```

- [ ] **Step 1: Testes**

```ts
it('encode/decode ida e volta', () => expect(decodeDrag(encodeDrag(['a','b']))).toEqual(['a','b']))
it('decodeDrag devolve [] para lixo: texto solto, objeto, array com número', () => {})
it('idsToDrag: arrastar um item selecionado leva toda a seleção', () => {})
it('idsToDrag: arrastar um item fora da seleção leva só ele', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Interface.** Linhas da lista com `draggable` pela alça ⋮⋮, `dataTransfer.setData(DRAG_MIME, encodeDrag(idsToDrag(...)))` e `effectAllowed = 'move'`. Cada pasta da barra lateral (inclusive Lixeira e Sem categoria, quando for pasta) aceita `onDragOver` (só se `DRAG_MIME` estiver nos tipos) e `onDrop` → `useLibrary().move(decodeDrag(...), pastaId)`; realce com a classe de "solte aqui" durante `dragenter`. `Esc` e soltar fora não fazem nada (comportamento nativo). `SelectionBar` mostra "N selecionados · Mover para… · Lixeira · Limpar". `MovePicker` é um diálogo com busca de pastas (sem acentos) que chama o mesmo `move`.
- [ ] **Step 6: Verificação manual no Chrome:** arrastar um item, arrastar uma seleção de 3, soltar na própria pasta (nada acontece), `Esc` no meio do arraste, "Mover para…" pelo teclado (Tab, Enter), Desfazer pelo aviso.
- [ ] **Step 7: Commit** `feat: seleção, mover para… e arrastar e soltar`.

### Task 7: Visão geral com resumo clicável

**Files:**
- Create: `src/core/overview.ts`, `src/ui/views/OverviewView.tsx`
- Modify: `src/ui/layout/Shell.tsx` (rota inicial = visão geral)
- Test: `tests/core/overview.test.ts`

**Interfaces:**
- Produces: `computeOverview(root: BmNode[], now: number, thresholdDays = 365): { total: number; inactive: number; duplicates: number; uncategorized: number; trash: number }` — `total` e as demais ignoram a Lixeira (menos `trash`); `inactive` = `findInactive(...).length`; `duplicates` = soma dos `extras` de `findDuplicates`.

- [ ] **Step 1: Testes**

```ts
it('total não conta os links da Lixeira e trash conta só eles', () => {})
it('inactive e duplicates ignoram a Lixeira (um link já descartado não volta a ser contado)', () => {})
it('uncategorized conta só links diretos nas raiz', () => {})
it('uma coleção vazia devolve tudo zero', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Interface.** Quatro cartões: favoritos, sem uso, quebrados (mostra "Testar links" até haver resultado), duplicados. Clicar em um dos três abre `{ name: 'cleanup', start }`. Abaixo, "Sem categoria" com a lista (modo salvo) para arrastar.
- [ ] **Step 6: Commit** `feat: visão geral com resumo clicável`.

### Task 8: Paleta de comandos (Ctrl K)

**Files:**
- Create: `src/core/palette.ts`, `src/ui/components/CommandPalette.tsx`
- Modify: `src/ui/layout/Shell.tsx` (atalho `Ctrl+K`/`Cmd+K`, abre e fecha com `Esc`)
- Test: `tests/core/palette.test.ts`

**Interfaces:**
- Produces:

```ts
export function normalizeText(s: string): string        // minúsculas, sem acentos
export type PaletteAction = 'backup' | 'analisar-sem-uso' | 'achar-duplicados' | 'testar-links' | 'ir-lixeira'
export type PaletteItem =
  | { kind: 'link'; id: string; title: string; url: string; path: string[] }
  | { kind: 'folder'; id: string; title: string; path: string[] }
  | { kind: 'action'; id: PaletteAction; label: string }
export function searchPalette(query: string, links: FlatLink[], folders: FolderInfo[], limits = { links: 8, folders: 6 }): PaletteItem[]
// busca vazia → só as ações; senão links e pastas que contêm o texto (título ou URL), e as ações cujo rótulo combina
```

- [ ] **Step 1: Testes**

```ts
it('normalizeText ignora acento e maiúscula: "Estúdos" casa com "estudos"', () => {})
it('busca vazia devolve só as ações', () => {})
it('acha link por título e por endereço, e pasta por nome', () => {})
it('respeita os limites (8 links, 6 pastas) com milhares de links', () => {})
it('texto sem resultado devolve lista vazia (sem lançar)', () => {})
it('uma pasta ou link com título vazio não quebra a busca', () => {})
```

- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Interface.** Diálogo central, ↑ ↓ para escolher, `Enter` executa, `Esc` fecha, foco preso dentro. Escolher um link abre a pasta dele; escolher uma pasta navega; "Mover 'X' para…" abre o `MovePicker` quando há um link destacado.
- [ ] **Step 6: Commit** `feat: paleta de comandos com Ctrl K`.

### Task 9: Limpeza, Backups e Lixeira no novo visual; acessibilidade

**Files:**
- Modify: `src/ui/CleanupTab.tsx` → `src/ui/views/CleanupView.tsx`, `src/ui/BackupsTab.tsx` → `src/ui/views/BackupsView.tsx` (mover os arquivos e trocar o markup/CSS pelos tokens; a lógica não muda), `src/ui/OverviewTab.tsx` (remover), `src/ui/layout/Sidebar.tsx` (contador de Limpeza); a revisão da Limpeza passa a usar o `LinkList` da Task 5
- Test: `tests/ui/cleanupStart.test.ts` (função pura `startAnalysis(start)` que diz qual análise a vista roda ao abrir)

**Interfaces:**
- `CleanupView` recebe `start?: 'sem-uso' | 'duplicado' | 'quebrado'` e roda a análise correspondente ao montar (`quebrado` só destaca o botão "Testar links", que exige o clique do usuário para pedir a permissão).

- [ ] **Step 1: Testes** de `startAnalysis`: `'sem-uso'` → `'inactive'`, `'duplicado'` → `'dups'`, `'quebrado'` → `'links-manual'`, `undefined` → nenhuma.
- [ ] **Step 2–4:** FAIL → implementar → PASS; `npm test` completo.
- [ ] **Step 5: Acessibilidade e foco:** todos os botões e linhas alcançáveis por `Tab` com foco visível; diálogos (`MovePicker`, paleta) com foco preso e `Esc`; `aria-label` nos ícones; `aria-live` no aviso; contraste já coberto pelo teste da Task 1.
- [ ] **Step 6: Verificação manual completa** (checklist abaixo) nos temas Escuro e Claro.
- [ ] **Step 7: Commit** `feat: limpeza, backups e lixeira no novo painel; acessibilidade`.

## Checklist de verificação manual (Chrome, perfil de teste sem conta)

- [ ] Abre escuro, sem piscar branco; ☀ ◐ ☾ funcionam e a escolha persiste.
- [ ] Árvore recolhível com contagens corretas; "Sem categoria" bate com o `chrome://bookmarks`.
- [ ] Lista, Cards e Compacto; o modo escolhido persiste.
- [ ] Arrastar 1 item, arrastar uma seleção, soltar na pasta de origem (nada), `Esc` no meio, "Mover para…" pelo teclado.
- [ ] Dois arrastes em menos de 10 min geram **um** backup automático; Desfazer desfaz o mais recente.
- [ ] `Ctrl K`: achar um favorito sem acento, ir para uma pasta, "Fazer backup agora".
- [ ] Os três cartões de problemas abrem a Limpeza com a análise certa.
- [ ] Limpeza, Backups e Lixeira funcionam como antes (mover, desfazer, restaurar, esvaziar).

---

## Self-Review

- **Cobertura do design:** §3 estrutura → Tasks 2, 6, 7; §4 interações → Tasks 4, 5, 8; §5 backup → Task 3; §6 visual → Task 1 e 9; §9 etapas → ordem das Tasks (tema e casca antes de arrastar). **Fora deste plano:** IA e os erros reportados (tratados depois).
- **Ordem:** Task 3 (backup compartilhado) vem antes da 4 porque `moveLinks` usa `shareBackup`; a Task 5 cria a casca (barra lateral, topo, lista, pasta); a Task 6 acrescenta seleção e arrastar sobre essa casca; as Tasks 7 a 9 completam as vistas.
- **Consistência de tipos:** `View`, `FolderNode`, `FolderInfo` (já existente em `tree.ts`) e `PaletteItem` têm uma definição só. `runPlan` ganha o 5º parâmetro `opts` sem mudar os existentes.
- **Review Focus:** itens 1–5 têm teste nas Tasks 1, 2, 3, 4, 5, 6 e 8.
- **Proporção:** o plano traz assinaturas, regras e asserções; o corpo do código fica para quem implementa.
