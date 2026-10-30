# Marcação "não mexer" e tabela com CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar favoritos e pastas como "não mexer", revisá-los numa tabela no painel e exportar/importar a estrutura inteira (pastas, favoritos, marcas, sugestões, aprovações) em CSV que o Google Planilhas abre.

**Architecture:** As marcas ficam num novo object store `flags` do IndexedDB, ligadas ao ID do item. Elas viajam no `Snapshot`, no diário de desfazer e no CSV. Toda escrita continua passando por `runPlan`, que ganha duas extensões pequenas: ids temporários também para links, e aplicação de marcas depois das operações. A lógica de CSV e de importação é pura, em `src/core/`, e a interface é uma vista nova, **Organizar**.

**Tech Stack:** React + TypeScript + WXT, Vitest, `idb` e `fake-indexeddb` (já no projeto). **Sem dependência nova** (o CSV é escrito à mão, com poucas regras).

**Spec:** `docs/superpowers/specs/2026-10-30-marcacao-e-csv-design.md`

## Global Constraints

- Sem dependência nova. Interface e mensagens em português do Brasil. Commits em português: `feat:`, `test:`, `docs:`.
- Os **214 testes existentes continuam passando** em toda tarefa; `npm run compile` sem erros.
- Toda mudança de favoritos passa por `runPlan` (plano → backup → aplicar → diário). Importar **só cria e move**: nunca remove nem renomeia. Pastas raiz do Chrome nunca são criadas, renomeadas, movidas ou removidas.
- Marca "não mexer": em favoritos e pastas; pasta marcada protege o que está dentro (proteção **efetiva** = marca própria ou de qualquer pasta ancestral). Ela só barra mudanças **automáticas**: mover à mão (arrastar, "Mover para…") continua permitido.
- CSV: UTF-8, separador **vírgula**, aspas duplas, linha de cabeçalho, quebras de linha `\r\n`. Colunas, nesta ordem: `tipo,caminho,titulo,url,ordem,nao_mexer,sugestao,aprovado,raiz`. `tipo` ∈ `pasta|link`; `nao_mexer` = `sim` ou vazio; `aprovado` = `sim|nao` ou vazio; `raiz` ∈ `barra|outros|mobile`.
- `caminho`: segmentos separados por `/`; dentro de um título `/` vira `\/` e `\` vira `\\`. Para um link, é a pasta que o contém; para uma pasta, é ela mesma. O primeiro segmento é o nome (informativo) da raiz.
- Contra fórmulas: o exportador põe `'` antes de um valor que comece com `=`, `+`, `-` ou `@`; o importador remove um `'` inicial só quando o caractere seguinte é um desses quatro.
- Chave de link no CSV: `normalizeUrl(url)` + raiz + caminho; duplicados na mesma pasta desempatam pela ordem de aparição. Chave de pasta: raiz + caminho. Link com URL não `http(s)` é ignorado na importação, com aviso na prévia.
- Casamento: chave exata primeiro; se não houver e a URL for **única** no navegador e no CSV, vira **mover** o existente; senão, **criar**. Itens existentes não são reordenados. Célula vazia de `sugestao`/`aprovado`/`nao_mexer` não apaga o que já existe.
- Tabela **Organizar**: só links (fora da Lixeira), paginada de 200 em 200 com `pageOf`. Pastas se marcam pelo menu da pasta na árvore lateral.

## Review Focus

1. **Título com vírgula, aspas, quebra de linha, `/`, `\`, emoji ou começando com `=`/`-`/`@`** faz a viagem exportar → importar sem mudar nem virar fórmula. → Tasks 4 e 5.
2. **CSV editado no Planilhas:** células vazias, linhas em branco no fim, colunas em outra ordem, BOM no início, `\n` em vez de `\r\n`, coluna faltando. Erro claro; nada aplicado em silêncio. → Task 5.
3. **Importar o mesmo CSV duas vezes** não cria nada na segunda vez nem duplica favoritos. → Task 6.
4. **Navegador vazio ou sem a pasta Mobile:** cria as pastas e favoritos; linhas de uma raiz inexistente são ignoradas com aviso. → Task 6.
5. **Favoritos duplicados** (mesma URL, pastas diferentes ou a mesma): cada um mantém a sua marca e nenhum é fundido. → Task 6.
6. **Marca em pasta protegendo descendentes** que o CSV manda mover: o item protegido não sai do lugar, e a prévia diz isso. → Task 6.
7. **Desfazer uma importação** remove o que ela criou, devolve o que moveu e restaura as marcas anteriores. → Task 2.

---

## File Structure

```
src/
  core/
    marks.ts            # ItemMark, MarksMap, isProtectedEffective, applyPatch, rootToken
    csv.ts              # parseCsv, toCsv (genérico: aspas, vírgulas, quebras, BOM)
    structureCsv.ts     # STRUCTURE_COLUMNS, exportStructure, parseStructure
    importPlan.ts       # planImport, assembleImportPlan, tipos da prévia
    organize.ts         # organizeRows e filtros da tabela
    plan.ts             # (muda) tempId em create-link, idMap, marcas e diário
    restore.ts          # (muda) planos de restauração levam as marcas
    snapshot.ts         # (muda) createSnapshot aceita marcas
    types.ts            # (muda) Operation, Plan, Snapshot, JournalEntry
  storage/
    db.ts               # (muda) versão 2 com migração
    flags.ts            # marksStore: all, get, put, delete
  ui/
    state/useLibrary.ts # (muda) marks, setProtected
    views/OrganizeView.tsx
    components/{ImportPreview.tsx, SelectionBar.tsx(muda)}
    layout/{Sidebar.tsx(muda), Shell.tsx(muda)}
    marksActions.ts     # exportar CSV, ler arquivo, aplicar importação
tests/ ... (um arquivo de teste por módulo acima)
```

---

### Task 1: Marcas no IndexedDB e proteção efetiva

**Files:**
- Create: `src/core/marks.ts`, `src/storage/flags.ts`
- Modify: `src/storage/db.ts` (versão 2)
- Test: `tests/core/marks.test.ts`, `tests/storage/flags.test.ts`

**Interfaces:**
- Produces (`src/core/marks.ts`):
  - `interface ItemMark { id: string; naoMexer?: boolean; sugestao?: string; aprovado?: 'sim' | 'nao' }`
  - `type MarksMap = Map<string, ItemMark>`
  - `isProtectedEffective(tree: BmNode[], marks: MarksMap, id: string): { protected: boolean; own: boolean; byFolderId?: string }`
  - `patchMark(prev: ItemMark | undefined, id: string, patch: Partial<Omit<ItemMark, 'id'>>): ItemMark | undefined` (aplica só campos definidos e não vazios; devolve `undefined` se o resultado ficar sem nenhum campo)
  - `rootToken(tree: BmNode[], rootId: string): 'barra' | 'outros' | 'mobile' | undefined` (ids `1`/`2`/`3`; senão pela posição entre as filhas da raiz)
- Produces (`src/storage/flags.ts`): `interface MarksStore { all(): Promise<ItemMark[]>; get(ids: string[]): Promise<(ItemMark | undefined)[]>; put(marks: ItemMark[]): Promise<void>; remove(ids: string[]): Promise<void> }` e `export const marksStore: MarksStore`.

- [ ] **Step 1: Testes de `marks`** — `isProtectedEffective`: marca própria → `{protected:true, own:true}`; filho de pasta marcada (dois níveis abaixo) → `{protected:true, own:false, byFolderId}`; sem marca → `protected:false`; id inexistente → `protected:false`. `patchMark`: campo vazio/`undefined` não apaga o que existe; `naoMexer:false` explícito remove só esse campo; resultado sem campos → `undefined`. `rootToken`: ids `1`,`2`,`3` → `barra`,`outros`,`mobile`; id de uma pasta que não é raiz → `undefined`.
- [ ] **Step 2: Testes de `flags`** (com `fake-indexeddb/auto` e `new IDBFactory()` no `beforeEach`, como em `tests/storage/snapshots.test.ts`): `put` + `all` ida e volta; `get` devolve `undefined` para id ausente; `remove` apaga. **Migração:** abrir um banco criado na versão 1 (só `snapshots` e `journal`, com um snapshot dentro) pela `openDb` nova → o snapshot continua lá e o store `flags` existe.
- [ ] **Step 3: Rodar** `npx vitest run tests/core/marks.test.ts tests/storage/flags.test.ts` → FAIL.
- [ ] **Step 4: Implementar.** `db.ts`: `openDB(DB_NAME, 2, { upgrade(db, oldVersion) { ... } })`, criando `snapshots`/`journal` só se `oldVersion < 1` e `flags` (`keyPath: 'id'`) se `oldVersion < 2`. `flags.ts` com uma transação por chamada via `withDb`.
- [ ] **Step 5: Rodar** os dois arquivos e `npm test` → PASS; `npm run compile`.
- [ ] **Step 6: Commit** `feat: marcas não mexer no IndexedDB e proteção efetiva`.

### Task 2: Marcas dentro do `runPlan`, do diário e do desfazer

**Files:**
- Modify: `src/core/types.ts`, `src/core/plan.ts`
- Test: `tests/core/plan.test.ts` (acrescentar)
- Modify (apoio de teste): `tests/fixtures/fakeApi.ts` ganha `makeFakeMarks(initial?: ItemMark[]): MarksStore & { data: Map<string, ItemMark> }`

**Interfaces:**
- Consumes: `ItemMark`, `patchMark`, `MarksStore` (Task 1).
- Produces (em `types.ts`):
  - `Operation` `create-link` ganha `tempId?: string`.
  - `interface PlanMark { target: string; patch: Partial<Omit<ItemMark, 'id'>> }` — `target` é um id real ou um `tempId` do próprio plano.
  - `Plan` ganha `marks?: PlanMark[]`.
  - `JournalEntry` ganha `marksBefore?: { id: string; prev: ItemMark | null }[]`.
- Produces (em `plan.ts`): `RunStore` ganha `marks?: MarksStore` (o padrão usa `marksStore`); `UndoStore` ganha `marks?: MarksStore`; `RunResult` ganha `idMap: Record<string, string>` (tempId → id real, de pastas **e** links).

- [ ] **Step 1: Testes** com `makeFakeApi` e `makeFakeMarks`:
  - plano com `create-link` de `tempId: 'l1'` e `marks: [{ target: 'l1', patch: { naoMexer: true } }]` → a marca é gravada no **id real** do link criado, e `result.idMap.l1` é esse id;
  - marca em id existente com `sugestao: 'X'` mantém `naoMexer` anterior (merge via `patchMark`);
  - `entry.marksBefore` guarda o estado anterior (`null` para o que não existia);
  - `undoLast` depois disso: remove o link criado, apaga a marca do link criado e restaura a marca antiga do item que já existia;
  - plano **sem** `marks` não toca o `MarksStore` (nenhuma chamada) e um plano só de marcas (sem operações) ainda grava a entrada no diário para poder ser desfeito;
  - falha ao criar um link (`failed`) → a marca ligada a ele é ignorada, sem erro.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** em `runPlan`: registrar `idMap` para `create-link` com `tempId`; depois das operações, resolver cada `PlanMark.target` por `idMap`, ler os estados anteriores, gravar e preencher `marksBefore`. A entrada vai ao diário se houver `inverse` **ou** `marksBefore`. Em `undoLast`, depois do inverso das operações, restaurar `marksBefore` (`prev: null` → `remove`).
- [ ] **Step 4: Rodar** `npx vitest run tests/core/plan.test.ts` e `npm test` → PASS; `npm run compile`.
- [ ] **Step 5: Commit** `feat: marcas no plano, no diário e no desfazer`.

### Task 3: Marcas nos backups e na restauração

**Files:**
- Modify: `src/core/snapshot.ts`, `src/core/types.ts` (`Snapshot.flags?: ItemMark[]`), `src/core/plan.ts` (o backup automático leva as marcas), `src/core/restore.ts`, `src/ui/backupActions.ts`
- Test: `tests/core/snapshot.test.ts`, `tests/core/restore.test.ts`, `tests/core/plan.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `PlanMark`, `Plan.marks`, `idMap` (Task 2).
- Produces: `createSnapshot(tree, reason, now, kind?, flags?: ItemMark[])`; `planRestoreAll` e `planRestoreItem` passam a devolver `Plan` com `marks` e com `tempId` em todo `create-link`/`create-folder`; cada marca do snapshot cujo `id` existe na árvore restaurada vira um `PlanMark` apontando para o `tempId` correspondente (itens que já existem e só são movidos mantêm a marca atual).

- [ ] **Step 1: Testes:** `createSnapshot` com `flags` guarda os dados e sem `flags` continua igual (snapshot antigo válido); `runPlan` grava no backup as marcas atuais de `store.marks`; `planRestoreAll` de um snapshot com `{id:'10', naoMexer:true}` produz `PlanMark` apontando para o `tempId` do link recriado, e executado com `runPlan` a marca fica no id novo; `planRestoreItem` de um item que ainda existe (move de volta) **não** duplica marca; snapshot sem `flags` restaura como antes (testes antigos intactos).
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** (em `recreate`, devolver o mapa id antigo → tempId). **Step 4: Rodar** `npm test` e `npm run compile` → PASS.
- [ ] **Step 5: Commit** `feat: backups e restauração levam as marcas`.

### Task 4: CSV genérico e exportação da estrutura

**Files:**
- Create: `src/core/csv.ts`, `src/core/structureCsv.ts`
- Test: `tests/core/csv.test.ts`, `tests/core/structureCsv.test.ts`

**Interfaces:**
- Consumes: `ItemMark`, `MarksMap`, `rootToken` (Task 1); `normalizeUrl` não é usado aqui.
- Produces (`csv.ts`): `toCsv(rows: string[][]): string` (`\r\n`, aspas só quando preciso) e `parseCsv(text: string): string[][]` (remove BOM; aceita `\r\n`, `\n`; campos entre aspas com vírgula, `""` e quebras; descarta linhas totalmente vazias).
- Produces (`structureCsv.ts`): `STRUCTURE_COLUMNS: readonly string[]` (as 9 colunas da Global Constraints); `interface StructureRow { tipo: 'pasta' | 'link'; raiz: 'barra' | 'outros' | 'mobile'; path: string[]; title: string; url: string; ordem: number; naoMexer: boolean; sugestao: string; aprovado: '' | 'sim' | 'nao' }`; `exportStructure(tree: BmNode[], marks: MarksMap): string`; helpers `encodePath(segments: string[]): string` e `decodePath(s: string): string[]`; `guardFormula(v: string): string` e `unguardFormula(v: string): string`.

- [ ] **Step 1: Testes de `csv`:** ida e volta de campos com vírgula, aspas duplas, `\n` dentro do campo, acentos e emoji; BOM no início é ignorado; `\n` simples como fim de linha; linha final sem quebra; linhas em branco no fim descartadas; campo vazio entre vírgulas preservado.
- [ ] **Step 2: Testes de `structureCsv`** com `sampleTree`: o cabeçalho é exatamente `tipo,caminho,titulo,url,ordem,nao_mexer,sugestao,aprovado,raiz`; a pasta `Dev` vira `tipo=pasta, caminho="Barra de favoritos/Dev", raiz=barra`; o link `MDN` vem com `caminho="Barra de favoritos/Dev"`, URL completa e `ordem=0`; link direto em Outros tem `caminho="Outros favoritos"`; pasta vazia (Mobile) aparece; marca `naoMexer` só na linha da pasta marcada, nunca nos descendentes; título `Foo/Bar` vira `Foo\/Bar` em `caminho` e `\` vira `\\`; título `=SOMA(A1)` sai como `'=SOMA(A1)`; `decodePath(encodePath(x))` devolve `x`; `unguardFormula("'=1")` → `=1` mas `unguardFormula("'abc")` → `'abc` e `unguardFormula("'x")` fica igual.
- [ ] **Step 3: Rodar** → FAIL. **Step 4: Implementar** `csv.ts` com um autômato de estados (sem regex complexa) e `exportStructure` percorrendo a árvore na ordem; a raiz do Chrome (`id` sem `parentId`) não vira linha.
- [ ] **Step 5: Rodar** os dois arquivos + `npm test` → PASS; `npm run compile`.
- [ ] **Step 6: Commit** `feat: CSV genérico e exportação da estrutura`.

### Task 5: Leitura e validação do CSV da estrutura

**Files:**
- Modify: `src/core/structureCsv.ts`
- Test: `tests/core/structureCsv.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `parseCsv`, `StructureRow`, `decodePath`, `unguardFormula` (Task 4).
- Produces: `interface RowIssue { line: number; message: string }`; `parseStructure(text: string): { rows: StructureRow[]; issues: RowIssue[]; fatal?: string }`. `line` conta a partir de 2 (a linha do cabeçalho é a 1). `fatal` preenchido quando faltam colunas obrigatórias (`tipo`, `caminho`, `titulo`, `raiz`; `url` obrigatória para links), e então `rows` vem vazio.

- [ ] **Step 1: Testes:** CSV exportado de `sampleTree` volta com as mesmas linhas (ida e volta, incluindo `nao_mexer`); colunas em **outra ordem** são lidas pelo nome do cabeçalho; coluna extra desconhecida é ignorada; falta a coluna `tipo` → `fatal` com a coluna citada; `tipo=foo` → issue na linha certa e as outras linhas seguem; `raiz` desconhecida → issue; `ordem` não numérica → vira posição de aparição, sem issue; `aprovado=talvez` → issue e a linha segue sem `aprovado`; `nao_mexer` aceita `sim`/`SIM`/`Sim` e trata qualquer outro valor como vazio; URL `chrome://x` ou `javascript:` em `tipo=link` → issue "URL não suportada" e a linha é descartada; arquivo vazio e arquivo só com cabeçalho → `rows` vazio, sem `fatal` no segundo.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** `parseStructure`. **Step 4: Rodar** `npm test` → PASS; `npm run compile`.
- [ ] **Step 5: Commit** `feat: leitura e validação do CSV da estrutura`.

### Task 6: Plano de importação

**Files:**
- Create: `src/core/importPlan.ts`
- Test: `tests/core/importPlan.test.ts`

**Interfaces:**
- Consumes: `StructureRow` (Task 4/5), `MarksMap`, `isProtectedEffective`, `rootToken`, `patchMark` (Task 1), `Plan`/`PlanMark` (Task 2), `normalizeUrl`, `flattenLinks`, `findNode`.
- Produces:
  - `type ImportKind = 'criar-link' | 'criar-pasta' | 'mover' | 'marcar'`
  - `interface ImportItem { key: string; kind: ImportKind; label: string; detail?: string; needsFolders: string[]; ops: Operation[]; marks: PlanMark[] }` — `needsFolders` lista as chaves das pastas (`raiz|caminho`) que precisam existir para o item valer.
  - `interface ImportPreview { items: ImportItem[]; blocked: { label: string; reason: string }[]; ignored: { label: string; reason: string }[] }`
  - `planImport(tree: BmNode[], marks: MarksMap, rows: StructureRow[]): ImportPreview`
  - `assembleImportPlan(preview: ImportPreview, selectedKeys: Set<string>, tree: BmNode[], now: number): Plan` — cria cada pasta necessária **uma vez** (pais antes dos filhos, com `tempId`), depois as operações dos itens escolhidos, e junta as marcas. Rótulo: `Importar estrutura (N itens)`. Sem itens escolhidos, devolve plano vazio.

- [ ] **Step 1: Testes** (árvore em memória; um helper cria CSV → linhas com `exportStructure` + `parseStructure`):
  - **Navegador vazio** (só as três raízes): importar a estrutura de `sampleTree` gera criar-pasta `Dev`, criar-link ×3, e ao montar e rodar o plano com `makeFakeApi` a árvore final tem os mesmos caminhos/URLs/ordem de criação do original.
  - **Idempotência:** importar o CSV exportado da própria árvore → `items` vazio (nada a criar, mover ou marcar).
  - **Mover:** link existente em Outros, CSV o coloca em `Dev`, URL única nos dois lados → um item `mover` (e nenhum `criar-link`); com a mesma URL repetida no navegador → `criar-link`.
  - **Duplicados:** mesma URL em duas pastas, uma marcada e a outra não → duas chaves distintas, cada marca vai só para o seu item; mesma URL duas vezes na mesma pasta → desempate pela ordem, sem fundir.
  - **Protegido:** link com marca própria, e link dentro de pasta marcada, que o CSV mandaria mover → vai para `blocked` com o motivo, não vira `mover`; a marca vinda do CSV em item protegido ainda é aplicada (`marcar`).
  - **Marcas:** `nao_mexer=sim` num link existente sem marca → item `marcar`; célula vazia não remove marca existente; `sugestao` e `aprovado` não vazios sobrescrevem.
  - **Raízes:** linha com `raiz=mobile` em navegador sem Mobile → `ignored` com motivo; título da raiz diferente (outro idioma) mas mesmo `raiz` → casa.
  - **Pastas:** pasta vazia do CSV → `criar-pasta`; pasta que já existe → nada; nunca gera `remove`, nem renomeia, nem mexe nas raízes.
  - **assemble:** desmarcar um item `criar-link` não cria as pastas que só ele pedia; dois itens na mesma pasta nova criam a pasta uma vez; toda operação `create-*` do plano tem `tempId` e `marks` apontam para eles.
- [ ] **Step 2: Rodar** `npx vitest run tests/core/importPlan.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** Indexar os links existentes por `normalizeUrl + raiz + caminho` e por URL normalizada (contagem). Resolver caminho→pasta existente pelos títulos a partir da raiz casada por `rootToken`. Nada além das `Operation` existentes (`create-folder`, `create-link`, `move`).
- [ ] **Step 4: Rodar** `npm test` e `npm run compile` → PASS.
- [ ] **Step 5: Commit** `feat: plano de importação da estrutura em CSV`.

### Task 7: Marcas no estado do painel, na árvore e na barra de seleção

**Files:**
- Modify: `src/ui/state/useLibrary.ts`, `src/ui/layout/Sidebar.tsx`, `src/ui/components/SelectionBar.tsx`, `src/ui/layout/Shell.tsx`, `src/ui/styles.css`
- Create: `src/core/organize.ts` (só a parte `folderLockInfo` desta tarefa; o resto vem na Task 8)
- Test: `tests/core/organize.test.ts`, `tests/ui/useLibraryMarks.test.ts` só se a lógica puder ser extraída para função pura (preferir função pura em `organize.ts`/`marks.ts`)

**Interfaces:**
- Consumes: `marksStore`, `MarksMap`, `isProtectedEffective`, `patchMark` (Task 1).
- Produces: `useLibrary()` devolve também `marks: MarksMap` e `setProtected(ids: string[], value: boolean): Promise<void>` (grava no `marksStore`, atualiza o estado e avisa com `notify`, ex.: "3 favoritos marcados como não mexer"; `reload` também recarrega as marcas). `SelectionBar` ganha props opcionais `onProtect?: () => void` e `onUnprotect?: () => void` (botões "Não mexer" / "Liberar"). `Sidebar` recebe `lockedFolderIds: Set<string>` e `onToggleFolderLock(id: string): void`.
- Produces (`organize.ts`): `lockedFolderIds(marks: MarksMap): Set<string>`.

- [ ] **Step 1: Teste** de `lockedFolderIds` (só ids com `naoMexer`) e do texto de aviso, se extraído.
- [ ] **Step 2: Implementar** o estado e a ação em `useLibrary`; cadeado 🔒 ao lado do nome das pastas marcadas na árvore; botão pequeno 🔒/🔓 na linha da pasta (visível ao passar o mouse e ao focar por teclado) com `aria-label` "Marcar <pasta> como não mexer" / "Liberar <pasta>"; só as marcas **próprias** de pasta se alternam.
- [ ] **Step 3: `npm test` e `npm run compile`** → PASS.
- [ ] **Step 4: Verificação manual** (`npm run build`, carregar no Chrome): marcar uma pasta mostra o cadeado; recarregar a página mantém; abrir o Backups e fazer um backup não quebra.
- [ ] **Step 5: Commit** `feat: marcar pastas como não mexer na árvore lateral`.

### Task 8: Vista Organizar (tabela de revisão)

**Files:**
- Modify: `src/core/organize.ts`, `src/core/route.ts` (`{ name: 'organize' }`), `src/ui/layout/Sidebar.tsx`, `src/ui/layout/Shell.tsx`, `src/ui/components/CommandPalette.tsx` e `src/core/palette.ts` (ação "Abrir Organizar"), `src/ui/styles.css`
- Create: `src/ui/views/OrganizeView.tsx`
- Test: `tests/core/organize.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `MarksMap`, `isProtectedEffective` (Task 1), `flattenLinks`, `normalizeText`, `pageOf`/`hasMore`, `findTrash`, `folderPath`.
- Produces (`organize.ts`):
  - `interface OrganizeRow { id: string; title: string; url: string; folderId: string; folderLabel: string; loose: boolean; own: boolean; inheritedFrom?: string; sugestao: string; aprovado: '' | 'sim' | 'nao' }`
  - `interface OrganizeFilters { query: string; onlyLoose: boolean; onlyProtected: boolean; onlySuggested: boolean; folderId?: string }`
  - `organizeRows(tree: BmNode[], marks: MarksMap, filters: OrganizeFilters): OrganizeRow[]` (sem a Lixeira; busca sem acento em título, URL e pasta; `folderLabel` = "Barra de favoritos › Dev"; link direto em raiz mostra o nome da raiz; `loose` = direto numa raiz; `inheritedFrom` = título da pasta marcada que protege o item sem marca própria).

- [ ] **Step 1: Testes** com `sampleTree` e marcas: cada filtro isolado e combinado; busca `"gítub"` acha `GitHub`; `onlyProtected` inclui o item protegido só por herança; `folderId` filtra pela pasta **e subpastas**; Lixeira nunca aparece; `own`/`inheritedFrom` corretos; árvore vazia → lista vazia.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** `organizeRows`.
- [ ] **Step 4: Implementar `OrganizeView`**: filtros no topo, tabela (seleção, título/endereço, pasta atual, caixa "Não mexer", sugestão, aprovado), `SelectionBar` com "Não mexer"/"Liberar"/"Mover para…", paginação de 200. Item protegido só por herança: caixa marcada e desabilitada, com 🔒 e `title` "Protegido pela pasta <nome>". A caixa tem `aria-label` com o título. Item novo "Organizar" na barra lateral e na paleta.
- [ ] **Step 5: `npm test` e `npm run compile`** → PASS.
- [ ] **Step 6: Commit** `feat: vista Organizar com tabela e filtros`.

### Task 9: Exportar e importar CSV na interface

**Files:**
- Create: `src/ui/marksActions.ts`, `src/ui/components/ImportPreview.tsx`
- Modify: `src/ui/views/OrganizeView.tsx`, `src/ui/layout/Shell.tsx`, `src/ui/styles.css`, `src/ui/fileName.ts`
- Test: `tests/ui/fileName.test.ts` (acrescentar), `tests/ui/marksActions.test.ts`

**Interfaces:**
- Consumes: `exportStructure`, `parseStructure` (Tasks 4–5), `planImport`, `assembleImportPlan` (Task 6), `runPlan` (Task 2), `downloadText`, `marksStore`, `chromeBookmarksApi`.
- Produces: `structureFileName(now: number): string` → `favoritos-estrutura-AAAA-MM-DD-HHMM.csv`; `exportStructureFile(tree, marks, now): void` (usa `downloadText` com `text/csv`); `previewImport(api: BookmarksApi, marks: MarksMap, text: string): Promise<{ preview: ImportPreview; issues: RowIssue[]; fatal?: string }>`; `applyImport(api: BookmarksApi, preview: ImportPreview, selected: Set<string>, now: number, store?: RunStore): Promise<{ applied: number; failed: number; planId?: string }>`.

- [ ] **Step 1: Testes** de `structureFileName` e de `previewImport`/`applyImport` com `makeFakeApi` + `makeFakeMarks`: arquivo inválido devolve `fatal` e não toca nada; aplicar com todos os itens marcados cria a estrutura e grava as marcas; aplicar com um item desmarcado não o cria; `failed` conta falhas sem abortar; o `planId` devolvido desfaz tudo com `undoIfLatest`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** as funções (sem estado de React).
- [ ] **Step 4: Interface** na vista Organizar: botão "Exportar CSV" (aviso curto "No Google Planilhas: Arquivo → Importar → Upload") e "Importar CSV…" (`<input type="file" accept=".csv,text/csv">`). A prévia abre num diálogo: resumo ("12 pastas e 140 favoritos a criar, 8 a mover, 3 marcas, 2 bloqueados, 1 ignorado"), lista com caixa por item (padrão: todos marcados), seções "Bloqueados por não mexer" e "Ignorados" (com o motivo), e "Aplicar". Enquanto aplica, botões desabilitados. Ao terminar: aviso com **Desfazer** (reaproveitar `lib.notify` + `planId`) e recarregar a árvore.
- [ ] **Step 5: `npm test` e `npm run compile`** → PASS.
- [ ] **Step 6: Commit** `feat: exportar e importar a estrutura em CSV`.

### Task 10: Documentação e verificação final

**Files:**
- Modify: `README.md` (recursos, roadmap), `PLANO.md` (marco 3), `docs/superpowers/plans/2026-10-30-marcacao-e-csv.md` (marcar o que foi feito)
- Create: `docs/decisions/0002-marcas-e-csv.md` (por que as marcas ficam na extensão, a chave URL + caminho, o resultado do teste de BOM no Planilhas)

- [ ] **Step 1: Verificação manual no Chrome** (perfil de teste, `npm run build`), anotando o resultado em `0002-marcas-e-csv.md`:
  - marcar favoritos e pastas; a caixa herdada fica travada; filtros da tabela;
  - **exportar → abrir no Google Planilhas** (Arquivo → Importar → Upload): acentos, emoji e colunas corretos? Decidir se o arquivo precisa de BOM (se não precisa, não colocar);
  - editar `nao_mexer` no Planilhas, baixar como CSV e importar de volta; a marca muda e nada mais;
  - importar o mesmo CSV em um **perfil vazio**: árvore igual; importar de novo: "nada a importar";
  - desfazer a importação; restaurar um backup com marcas.
- [ ] **Step 2: Se o BOM for necessário**, ajustar `toCsv`/`exportStructureFile` e acrescentar o teste correspondente.
- [ ] **Step 3: `npm test`, `npm run compile`, `npm run build`** → tudo passa.
- [ ] **Step 4: Atualizar README e PLANO.md; Commit** `docs: marcação, CSV e verificação do marco 3`.

---

## Self-Review

- **Cobertura da spec:** §3 marca/herança/backup → Tasks 1–3, 7; §4 tabela → Task 8; §5 CSV, chave, importação, prévia, desfazer → Tasks 4–6 e 9; §7 regras 1–8 → herança (1, 8), casamento (6), `ordem` (6), store único (1–2), desfazer com marcas (2), `raiz` (4–6), escape (4–5); §9 verificação → Task 10. Marcas órfãs (§3) ficam inativas e sem limpeza: o prazo era do construtor e nada depende dele.
- **Consistência de tipos:** `ItemMark`, `MarksMap`, `MarksStore`, `PlanMark`, `StructureRow`, `ImportItem`, `ImportPreview` são definidos antes de serem usados; `idMap` e `tempId` em `create-link` nascem na Task 2 e são usados nas Tasks 3, 6 e 9.
- **Proporção:** as tarefas descrevem interfaces e testes; os corpos das funções ficam com quem implementa.
