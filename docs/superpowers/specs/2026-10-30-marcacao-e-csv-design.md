# Marcação "não mexer" e tabela com CSV — design

Primeiro de dois projetos para o Marco 3/4 do `PLANO.md`. Este entrega a **tabela de revisão no painel**, a marca **"não mexer"** e a **exportação/importação da estrutura em CSV**. O segundo projeto (análise com IA) fica para outro design e vai preencher as colunas de sugestão que este já deixa prontas.

> _(Autor)_ = decidido por Gustavo na conversa. _(Claude)_ = escolha provisória, pode ser trocada.

## 1. Por que

Gustavo tem muitos favoritos soltos e quer, no fim, que uma IA sugira pastas para todos eles. Antes disso precisa de três coisas que servem sozinhas:

1. Uma forma de dizer "este favorito (ou esta pasta) fica onde está", para que nenhuma varredura futura mexa neles.
2. Uma tabela única onde ver e revisar todos os favoritos, com pasta atual, sugestão e aceite.
3. Levar e trazer a **estrutura inteira** (pastas e favoritos, com as marcas) por um arquivo, para usar em outro navegador ou guardar fora do Chrome.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Marcar e desmarcar "não mexer" em favoritos e em pastas, no painel.
- Uma vista em tabela com todos os favoritos, filtrável e com marcação em massa.
- Exportar um CSV com a estrutura completa e importá-lo em outro navegador (ou no mesmo), criando as pastas e os favoritos que faltarem.
- O CSV abre bem no **Google Planilhas** _(Autor)_.
- As colunas de sugestão e aprovação já existem e são lidas e escritas pelo CSV, mesmo que ainda ninguém as preencha (a IA virá no projeto 2).

**Não-objetivos**
- Chamar IA, ler o conteúdo das páginas, estimar custo (projeto 2).
- Sincronizar a marca entre computadores sozinho. A marca viaja pelo CSV ou pelo backup.
- Editar o CSV como forma principal de trabalho: a revisão acontece no painel _(Autor)_.
- Importar de HTML/outros formatos, mesclar dois CSV, apagar favoritos que não estão no CSV.

**Anti-objetivos**
- Importar um CSV e mudar, mover ou apagar algo sem prévia, backup e como desfazer.
- Uma importação que apaga ou sobrescreve o que o navegador já tem. Importar **só cria e move**; nunca remove.
- Perder a marca "não mexer" ao mover/renomear pastas ou ao restaurar um backup.
- Um CSV que o Google Planilhas abre com acentos quebrados ou colunas deslocadas.

## 3. Marca "não mexer"

- **Onde vale** _(Autor)_: em favoritos e em pastas. Pasta marcada protege tudo o que está dentro dela _(Claude)_.
- **Efeito:** qualquer varredura ou proposta futura (IA, regras) ignora o item. A marca **não impede** o próprio usuário de mover o item à mão, por arrastar, "Mover para…" ou importação explícita; só protege contra mudanças automáticas.
- **Onde fica:** no armazenamento local da extensão (IndexedDB, novo object store `flags`, subindo a versão do banco), ligado ao ID do favorito ou da pasta _(Autor decidiu guardar na extensão; o Chrome não permite campos extras em favoritos)_.
- **Duplicados** _(Autor)_: cada favorito tem seu próprio ID e sua própria marca; um pode estar marcado e o outro não. Duplicidade continua sendo definida só pela URL normalizada (`normalizeUrl`), como na Limpeza.
- **Backups:** o snapshot passa a incluir as marcas (por exemplo um campo `flags` no `Snapshot`), e restaurar um backup recria as marcas ligadas aos novos IDs. Backups antigos, sem o campo, continuam válidos _(Claude)_.
- **Marcas órfãs:** se o favorito/pasta some do Chrome, a marca fica guardada mas inativa; a extensão a descarta depois de um tempo ou ao detectar o ID inexistente em uma sincronização _(Claude; prazo fica para o plano)_.

## 4. Tabela de revisão no painel

Nova vista na barra lateral, **Organizar**, com uma linha por favorito:

| Coluna | Conteúdo |
|---|---|
| Seleção | caixa de marcação |
| Título e endereço | como na lista atual |
| Pasta atual | caminho completo |
| Não mexer | caixa que liga/desliga a marca |
| Sugestão | pasta sugerida (vazia até o projeto 2) |
| Aprovado | sim / não / pendente (vazio até o projeto 2) |

- Filtros: só soltos (direto em Barra/Outros/Mobile), só marcados "não mexer", só com sugestão, por pasta, e busca por texto sem acento _(Claude)_.
- Marcação em massa: selecionar vários e "Marcar não mexer" / "Desmarcar" na barra de seleção já existente.
- Pastas marcadas aparecem com um cadeado na árvore lateral; a marca de pasta é alternável no menu da pasta _(Claude)_.
- Precisa aguentar milhares de linhas sem travar (paginação ou lista virtualizada; o projeto já tem `paging.ts`).

## 5. CSV

**Formato** _(Autor pediu Google Planilhas; detalhes Claude)_
- UTF-8, separador **vírgula**, aspas duplas para campos com vírgula ou quebra de linha, primeira linha com os nomes das colunas. Abre em Arquivo → Importar → Upload do Google Planilhas. Marca de ordem de bytes (BOM) é decisão do plano, a verificar abrindo o arquivo no Planilhas.
- Campos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo na exportação, para a planilha não os interpretar como fórmula _(Claude)_.

**Colunas** (uma linha por pasta e por favorito)

| Coluna | Significado |
|---|---|
| `tipo` | `pasta` ou `link` |
| `caminho` | caminho da pasta que contém o item; para uma pasta, o caminho dela mesma. Separador `/`, com `/` nos títulos escapado |
| `titulo` | título |
| `url` | URL completa (vazia em pastas) |
| `ordem` | posição dentro da pasta |
| `nao_mexer` | `sim` ou vazio |
| `sugestao` | caminho da pasta sugerida (vazio por enquanto) |
| `aprovado` | `sim`, `nao` ou vazio |
| `raiz` | `barra`, `outros` ou `mobile` (ver seção 7) |

A raiz do Chrome (Barra de favoritos, Outros favoritos, Mobile) aparece nos caminhos como primeiro segmento, para a estrutura ser reproduzível.

**Chave de cada linha** _(Autor: ID não serve entre navegadores)_
- Link: `url normalizada` + `caminho`. Dois links iguais em pastas diferentes são linhas diferentes, cada um com a sua marca. Dois links iguais **na mesma pasta** são desempatados pela coluna `ordem` _(Claude)_.
- Pasta: o `caminho` completo.

**Exportar** gera o CSV do estado atual (pastas, favoritos, marcas, sugestões, aprovações), sem alterar nada no navegador.

**Importar** (também em um navegador vazio) segue o fluxo de segurança do projeto: **plano → prévia → backup → aplicar → diário de desfazer** _(Autor decidiu criar pastas e favoritos que faltam)_:
1. Lê o CSV e valida (colunas obrigatórias, `tipo` válido, URLs http/https, caminhos que começam por uma raiz conhecida). Linhas inválidas são listadas na prévia e ignoradas; nada é aplicado em silêncio.
2. Casa cada linha com o que existe, pela chave acima.
3. Monta o plano: **criar** pastas e favoritos que faltam, **mover** favoritos que existem mas estão em outra pasta que o CSV indica, **gravar** as marcas. Nunca remove nem renomeia.
4. A prévia mostra contagens e a lista do que muda (criados, movidos, marcas alteradas, linhas ignoradas), e o usuário desmarca o que não quer.
5. Respeita a marca "não mexer" que **já existe** no navegador: um favorito marcado não é movido por importação, e a prévia diz isso _(Claude; a marca vinda do CSV em si é aplicada)_.
6. Aplica em lotes, com backup antes (se falhar, nada muda), e permite desfazer pelo mesmo mecanismo do resto (as criações desfazem com `remove`, que o diário já usa para o inverso).

Pastas raiz do Chrome nunca são criadas, renomeadas ou removidas, como já vale no resto do projeto.

## 6. Decisões de implementação já tomadas

- Lógica de CSV (gerar, ler, validar) e de casamento de linhas em `src/core/`, sem depender do Chrome, testada com Vitest. A interface fica em `src/ui/`.
- Marcas em IndexedDB via `src/storage/` (novo object store, `DB` versão 2 com migração). Interface de armazenamento injetável nos testes, como `RunStore`.
- O plano de importação usa as `Operation` existentes (`create-folder`, `create-link`, `move`) e `runPlan`, sem caminho novo de escrita.
- Reaproveitar `normalizeUrl`, `flattenLinks`/árvore e a política de backup compartilhado.
- Tudo em português do Brasil na interface.

## 7. Regras fechadas na revisão _(todas escolha do Claude)_

1. **Marca em pasta e herança.** O CSV grava `sim` só na linha da própria pasta, nunca nos descendentes. A proteção efetiva de um item é: marca própria **ou** marca em qualquer pasta ancestral. Na tabela, um item protegido só por herança aparece com a caixa marcada, desabilitada, e o cadeado da pasta de origem; só a marca própria é alternável. Na importação, "já protegido" usa a proteção efetiva.
2. **Casar um link com outra pasta.** Primeiro tenta a chave exata (URL normalizada + caminho). Se não houver, e a URL for **única** tanto no navegador quanto no CSV, a linha vale como **mover** o favorito existente. Se a URL for repetida (duplicados), a linha vale como **criar**. A prévia diz qual dos dois aconteceu em cada linha.
3. **`ordem` na importação.** Serve só para desempatar duplicados na mesma pasta e para criar itens novos na sequência do CSV. Itens que já existem **não são reordenados**; uma `ordem` diferente da atual é ignorada sem aviso.
4. **Sugestão e aprovação.** Ficam no mesmo object store `flags`, ligadas ao item (campos `naoMexer`, `sugestao`, `aprovado`). A importação sobrescreve esses campos com os valores **não vazios** do CSV; célula vazia não apaga o que já existe.
5. **Marcas, IDs novos e desfazer.** A importação grava as marcas depois de cada `create-*` devolver o ID novo. A entrada do diário guarda o estado anterior das marcas alteradas, e "Desfazer" as restaura junto com as operações. Marcar/desmarcar pela tabela ou pelo menu é instantâneo e reversível pelo próprio clique; não gera backup, mas o snapshot seguinte já leva as marcas.
6. **Pastas raiz entre idiomas.** O CSV tem uma coluna extra `raiz` com um token fixo (`barra`, `outros` ou `mobile`); o primeiro segmento de `caminho` é só informativo. A importação casa a raiz pelo token, não pelo título traduzido.
7. **Escape.** Em `caminho`, `/` dentro de um título vira `\/` e `\` vira `\\`. Contra fórmulas, o exportador põe `'` antes de um valor que comece com `=`, `+`, `-` ou `@`; o importador remove um `'` inicial somente quando o caractere seguinte é um desses quatro.
8. **A tabela lista só links.** Pastas são marcadas pelo menu da pasta na árvore. Favoritos direto numa raiz mostram o nome da raiz em "Pasta atual".

## 8. Deixado ao construtor

- Nome exato dos campos e do object store, e como `Snapshot` carrega as marcas.
- Tamanho dos lotes na importação e como mostrar o progresso.
- Paginação ou virtualização da tabela.
- Texto exato das mensagens de erro e da prévia.
- Prazo para descartar marcas órfãs.
- Se o BOM é necessário (testar abrindo o CSV no Google Planilhas).

## 9. Verificação

- Testes automatizados: CSV (ida e volta, acentos, vírgulas, aspas, quebras de linha, fórmulas), casamento por chave (duplicados em pastas diferentes e na mesma pasta), plano de importação (criar, mover, ignorar marcados, nunca remover), snapshot com marcas.
- Manual no Chrome com perfil de teste: marcar/desmarcar, exportar, abrir no Google Planilhas e conferir acentos, editar `nao_mexer` lá, importar de volta; importar o mesmo CSV em um perfil vazio e comparar a árvore; desfazer a importação.

## 10. Fora deste projeto

Projeto 2 — análise com IA: leitura local das páginas (título, descrição, primeiro título, trecho), adaptador da Anthropic, prévia do que será enviado, estimativa de custo, lotes com pausa, sugestão que prefere pastas existentes, análise de "só soltos" ou "todos". Ele preenche `sugestao` e `aprovado` e respeita `nao_mexer`.
