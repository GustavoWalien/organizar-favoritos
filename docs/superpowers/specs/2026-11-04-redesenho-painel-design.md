# Redesenho do painel e do popup — design

Segunda versão da interface. O painel atual (design de 29/10, [`2026-10-29-novo-painel-design.md`](2026-10-29-novo-painel-design.md)) funciona, mas mostra pouco e deixa o usuário descobrir sozinho o que fazer. Esta versão transforma a Visão geral num dashboard, deixa a Limpeza guiada, simplifica os Backups e transforma o popup do ícone num resumo.

> Status: **layout aprovado** pelo Gustavo em 04/11/2026, a partir do quadro de design [Redesenho do painel](https://claude.ai/artifact/2hrh5cvsUFPDNAZhbY7ChL) (telas 1 a 4 e a barra lateral). _(Autor)_ = decidido pelo Gustavo. _(Claude)_ = escolha provisória que pode ser trocada. Os números do quadro são de exemplo.

## 1. Por que

No teste manual de 04/11, o autor achou que o painel podia "ficar mais voltado a um dashboard e melhorar a usabilidade das funções". Pela leitura do código, os problemas concretos são estes _(Claude)_:
- A Visão geral tem quatro números e uma lista. O cartão "quebrados" mostra `?` para sempre, porque o resultado do teste de links não é guardado.
- A Limpeza abre vazia e exige escolher entre quatro botões "Analisar…/Achar…". Os duplicados aparecem como lista solta, sem mostrar qual cópia fica.
- Cada backup tem quatro botões na mesma linha.
- O popup tem dois botões cinza (sem o CSS do painel) e não diz nada sobre o estado dos favoritos.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Ao abrir o painel ou o popup, entender **em segundos** quão organizados estão os favoritos e **qual é o próximo passo**.
- Toda contagem leva à ação: um clique num número abre a tela que resolve aquilo.
- A Limpeza mostra o resultado **sem precisar clicar** em "analisar", exceto o teste de links (que usa rede e permissão).
- Duplicados em grupos, com a cópia que fica marcada e trocável.
- O popup como mini-dashboard com atalhos para as telas certas.

**Não-objetivos (nesta entrega)**
- A IA (marco 4). A entrada "Sugestões da IA" e o botão "Sugerir pastas com IA" aparecem desabilitados, com "em breve".
- O redesenho da marca "não mexer" (em espera, ver [`docs/melhorias.md`](../../melhorias.md)). O cadeado sai da barra lateral. A coluna "Não mexer" da vista Organizar e o CSV continuam como estão.
- A Limpeza respeitar a marca "não mexer" (pendência separada, ponto 3 de `docs/melhorias.md`).
- Mudar o comportamento de pastas, arrastar e soltar, paleta `Ctrl K`, vista Organizar ou importação do CSV. Essas telas só ganham a nova estrutura em volta.

**Anti-objetivos**
- Um dashboard bonito que fica lento: o painel e o popup precisam abrir rápido com milhares de favoritos.
- Números que mentem: cada contagem tem uma definição única (seção 5), e a mesma conta alimenta o painel, o popup e a barra lateral.
- Perder segurança: nada muda o fluxo plano → backup → aplicar → desfazer.

## 3. Restrições

- Mesma stack: React 19 + TypeScript + WXT, CSS próprio com os tokens de `src/ui/theme/tokens.ts`, sem biblioteca de UI nem de gráficos. Gráficos são `div`s e SVG simples, como no quadro.
- Os ícones passam a ser SVG de traço (como no quadro), no lugar dos emoji atuais _(Claude)_.
- Tema claro, escuro e sistema continuam valendo para todas as telas novas e para o popup. O teste de contraste (`tests/ui/contrast.test.ts`) cobre qualquer par de cores novo.
- Toda lógica de contagem fica em `src/core/` como função pura testada com Vitest. A interface só desenha.
- Sem nova versão do IndexedDB: os dados novos (seção 6) vão para `chrome.storage.local` _(Claude: a subida de versão do banco não tem volta, ver decisão 0002)_.

## 4. Telas

### 4.1 Barra lateral _(Autor aprovou o quadro)_

De cima para baixo:
- Marca do app.
- **Visão geral**.
- Grupo **Tarefas**:
  - **Limpeza**, com selo "a revisar" (seção 5);
  - **Organizar**, com o texto "N soltos" (sem categoria);
  - **Sugestões da IA**, com etiqueta "novo", desabilitada até o marco 4.
- Grupo **Pastas**:
  - três botões de ícone: expandir tudo, recolher tudo e nova pasta, cada um com `aria-label` e `title`;
  - a árvore com contagens, como hoje, mas **sem o cadeado**;
  - "Sem categoria".
- Rodapé, separado por uma linha:
  - **Lixeira**, com contagem;
  - **Backups**, com a idade do último backup ("há 2 h"), em verde se tiver menos de 7 dias e em laranja se for mais antigo _(Claude)_.

Arrastar favoritos para uma pasta, para Sem categoria ou para a Lixeira continua igual.

### 4.2 Topo

Busca `Ctrl K` em destaque, à esquerda e larga, com o texto "Buscar favoritos, pastas ou ações…". À direita ficam **Fazer backup** e o seletor de tema. O alternador Lista/Cards/Compacto aparece só nas telas que listam favoritos (pasta, Sem categoria, Lixeira), como hoje. O botão "Sugerir pastas · em breve" sai do topo e vai para o cabeçalho da Visão geral.

### 4.3 Visão geral (dashboard) — quadro, tela 1

- **Cabeçalho:** "Seus favoritos", com a linha "N favoritos em M pastas · último backup há X · [nada pendente para desfazer | Desfazer: <rótulo>]". À direita, o botão principal **Sugerir pastas com IA**, desabilitado com "em breve".
- **Linha 1:**
  - Cartão **Organização**, com dois espaços de largura: a porcentagem "em pastas" em destaque, uma barra de dois segmentos (em pastas, sem categoria) e, abaixo, a linha "N a revisar →", em laranja, que abre a Limpeza (seção 5.2). Os itens da legenda são links: "Sem categoria" abre a tela Sem categoria.
  - Três cartões clicáveis:
    - **Sem uso:** abre a Limpeza na aba Sem uso.
    - **Duplicados:** abre a aba Duplicados.
    - **Links quebrados:** mostra o número do último teste e "testado há X" (ou "teste incompleto · há X", seção 6.1); se nunca houve teste, mostra "—", "nunca testados" e o botão **Testar agora**. Esse botão pede a permissão no próprio clique, como hoje, abre a aba Links quebrados e já começa o teste, porque tudo acontece na mesma página.
- **Linha 2:**
  - **Próximos passos:** até 4 itens, na ordem da seção 5.5, cada um com uma ação. Os itens já resolvidos aparecem com ✓ e em cinza.
  - **Maiores pastas:** as 6 maiores, com barras horizontais proporcionais à maior. Um clique abre a pasta.
- **Linha 3:**
  - **Quando você usou cada favorito:** colunas por faixa (seção 5.3). A faixa "+1 ano" fica em laranja, a cor de "sem uso".
  - **Atividade recente:** as 5 entradas mais recentes do diário (rótulo e quando). Só a primeira tem **Desfazer**, como hoje. Há também o link "Ver backups".
- A lista "Sem categoria" que hoje fica embaixo da Visão geral **sai** daqui. Ela continua na própria tela de Sem categoria, a um clique pela legenda, pelo próximo passo ou pela barra lateral.

### 4.4 Limpeza guiada — quadro, tela 2

- Cabeçalho com a frase "A análise roda sozinha ao abrir. Nada é apagado: tudo vai para a Lixeira, com backup antes e Desfazer depois."
- **Quatro abas em cartões**, cada uma com a contagem: Sem uso há +N meses, Duplicados, Links quebrados e Pastas vazias. Ao abrir a tela, sem uso, duplicados e pastas vazias são calculados na hora, porque são locais e rápidos. A aba Links quebrados mostra o resultado guardado (seção 6.1) ou "Testar agora". Abre na aba pedida pela rota (seção 4.7) e, sem pedido, na primeira aba que tiver itens.
- O limiar de "sem uso" (hoje um campo na barra da Limpeza) fica como seletor dentro da aba Sem uso. Ele é **guardado** (seção 6.3) e vale para todas as contagens: trocar o limiar atualiza o painel inteiro, e o popup usa o mesmo valor _(Claude)_.
- **Aba Duplicados**:
  - Cada grupo é um cartão com título, endereço e "N cópias", mais uma caixa para incluir ou tirar o grupo. Cada cópia é uma linha com botão de rádio "manter", o caminho da pasta, o último uso e a etiqueta "fica" ou "vai p/ Lixeira".
  - O seletor **"Manter qual cópia"** muda a sugestão em todos os grupos (seção 5.6). Uma troca feita à mão num grupo vale mais que o seletor.
  - Os grupos aparecem 20 de cada vez, com "Mostrar mais".
- **Abas Sem uso, Links quebrados e Pastas vazias:** o conteúdo atual (lista com seleção, filtro e "abrir o link"), na estrutura nova. Em Links quebrados, o filtro "quebrado / incerto" continua, e os incertos nunca vêm marcados.
- **Barra de ação fixa no rodapé**: "N escolhidos · X vão para a Lixeira · Y ficam" (em Duplicados) ou "N escolhidos" (nas outras abas), com **Desmarcar todos** e o botão principal **Mover X para a Lixeira**. A confirmação e o fluxo atuais continuam: backup, aplicar e aviso com Desfazer.
- A Lixeira (esvaziar) continua na tela da Lixeira e sai do pé da Limpeza.
- O botão "Desfazer: <rótulo>" que hoje fica na Limpeza sai daqui: o Desfazer está no aviso e na Atividade recente.

### 4.5 Backups — quadro, tela 3

- Cabeçalho com a frase "Um backup é feito sozinho antes de cada mudança. Restaurar nunca apaga nada: cria uma pasta nova." e o botão principal **Fazer backup agora**.
- **Três cartões:**
  - **Último backup:** a idade e o motivo.
  - **Guardados:** "A + M", com a legenda "A de 20 automáticos · M manuais (nunca apagados)".
  - **Cópia fora do navegador:** a idade da última exportação (seção 6.2), ou "nunca", com a dica "exporte em HTML para guardar no computador". Fica laranja com mais de 30 dias ou quando nunca houve exportação _(Claude)_.
- **Histórico:** uma linha por backup com quando (relativo e data), motivo, "N favoritos · M pastas", etiqueta automático/manual, botão **Restaurar…** e menu **⋯** com Exportar HTML e Exportar JSON.
- **Restaurar…** abre um diálogo com duas opções: "Restaurar tudo" (cria `Restaurado em <data>`, como hoje) e "Restaurar um item", com a busca por item que hoje se abre na linha.
- **Busca "Achar um favorito apagado…"** no cabeçalho do histórico: procura por título ou endereço em todos os backups guardados e mostra só os favoritos que **não existem mais** na árvore atual, comparando pelo endereço normalizado. Cada resultado traz o backup mais recente que o contém e um botão **Restaurar**, que usa a restauração por item atual. A busca roda localmente, a partir de 2 caracteres, com no máximo 50 resultados _(Claude)_.

### 4.6 Popup do ícone — quadro, tela 4 _(Autor aprovou a ideia)_

360 px de largura, com o mesmo CSS e o mesmo tema do painel (corrige os botões cinza). De cima para baixo:
1. Marca e "N favoritos · M pastas".
2. Cartão **Organização**: porcentagem, barra de dois segmentos e "X em pastas · Y sem categoria".
3. Três números clicáveis: sem uso, duplicados e **a revisar**. Cada um abre o painel numa aba nova, na tela certa (seção 4.7), e fecha o popup.
4. **Próximo passo**: só o primeiro item não resolvido da seção 5.5, clicável. Se tudo estiver resolvido, mostra "Tudo em dia". O popup **nunca inicia** o teste de links: o passo "Testar os links" abre a aba Links quebrados, onde o usuário clica em "Testar agora". O pedido de permissão do Chrome precisa de um clique na própria página, e o popup fecha ao abrir a aba nova _(Claude)_.
5. Rodapé: "Último backup há X", **Fazer backup** (mostra "Fazendo backup…" e depois "Backup feito", no lugar da linha do último backup) e **Abrir painel** (principal).

O popup usa as mesmas funções de `src/core/` que o painel. Se o painel já estiver aberto numa aba, os atalhos abrem uma aba nova mesmo assim _(Claude: reaproveitar a aba aberta fica para depois)_.

### 4.7 Endereço de cada tela (rota no `#`)

O painel passa a ler e escrever a tela atual no `#` do endereço. Assim, o popup abre a tela certa e recarregar a página não volta para a Visão geral. O formato é este _(Claude)_:

| Tela | Endereço |
|---|---|
| Visão geral | `dashboard.html` ou `#/` |
| Limpeza (aba) | `#/limpeza`, `#/limpeza/sem-uso`, `#/limpeza/duplicados`, `#/limpeza/quebrados`, `#/limpeza/pastas-vazias` |
| Pasta | `#/pasta/<id>` |
| Sem categoria | `#/sem-categoria` |
| Organizar | `#/organizar` |
| Backups | `#/backups` |
| Lixeira | `#/lixeira` |

A rota diz só a tela e a aba, nunca uma ação: recarregar a página não inicia nada (nem o teste de links, que usa a rede). Um endereço desconhecido ou uma pasta que não existe mais leva à Visão geral, sem erro. A conversão entre endereço e tela (`View`) é uma função pura com teste de ida e volta. Botão voltar do navegador: cada troca de tela vira uma entrada no histórico (`pushState`). "Voltar" funciona como esperado _(Claude)_.

## 5. Definições das contagens

Todas excluem a Lixeira da extensão. "Favorito" é um link; pastas não contam.

### 5.1 A revisar
A união, sem repetir ids, de:
- favoritos **sem uso** (regra atual de `findInactive`, com o limiar guardado da seção 6.3, padrão de 12 meses);
- **cópias a mais** dos duplicados, isto é, as que iriam para a Lixeira pela sugestão atual (seção 5.6);
- favoritos **quebrados** no último teste guardado (só `quebrado`; `incerto` fica de fora).

Esse número aparece no selo da Limpeza na barra lateral, na linha "N a revisar" do cartão Organização e no popup.

### 5.2 Barra de Organização (dois segmentos que somam o total)
- **Sem categoria:** favoritos direto nas pastas raiz (regra atual de `uncategorizedLinks`). É **um número só** em todo lugar: o segmento da barra, "N soltos" na barra lateral, o passo 5, a linha de Maiores pastas e a tela Sem categoria.
- **Em pastas:** o resto (total − sem categoria).
- "A revisar" (seção 5.1) **não é segmento**: ele se sobrepõe às duas partes (um favorito pode estar sem categoria e sem uso ao mesmo tempo). Por isso aparece como uma linha à parte, abaixo da barra.
- A porcentagem é "em pastas" ÷ total, arredondada para baixo _(Claude: só mostra 100% quando está tudo de fato organizado)_. Com 0 favoritos, a barra fica vazia e o texto diz "Nenhum favorito ainda".
- Mudança em relação ao quadro, que tem três segmentos: a terceira cor (laranja, "a revisar") sai da barra. Com três segmentos, o mesmo nome "sem categoria" teria dois números diferentes na mesma tela _(Claude)_.

### 5.3 Quando você usou cada favorito
Pelo `dateLastUsed` de cada favorito, comparado com agora:
- **este mês:** até 30 dias;
- **1–3 meses:** de 31 a 90 dias;
- **3–12 meses:** de 91 a 365 dias;
- **+1 ano:** mais de 365 dias;
- **sem registro:** sem `dateLastUsed`.

Essas faixas são fixas e não seguem o limiar da Limpeza _(Claude)_. As alturas das colunas são proporcionais à maior.

### 5.4 Maiores pastas
As subpastas de primeiro nível da Barra, de Outros e de Mobile (as mesmas da raiz da árvore lateral, sem a Lixeira), ordenadas pela contagem da subárvore (a mesma `count` da árvore lateral), mais "Sem categoria" como uma pasta a mais com a sua contagem. Entram as 6 primeiras. No empate, vale a ordem da árvore.

### 5.5 Próximos passos (ordem e regras)
A lista é calculada por uma função pura a partir das contagens, do último teste de links e das datas dos backups. Em ordem:
1. **Juntar N duplicados**: se houver cópias a mais. Ação: Limpeza › Duplicados.
2. **Testar os links**: se nunca houve teste, se o último ficou incompleto ou se o último completo foi há mais de 30 dias. Ação: no painel, Limpeza › Links quebrados, já iniciando o teste (o clique no passo pede a permissão); no popup, só abre a aba (seção 4.6).
3. **Revisar N quebrados**: se o último teste achou quebrados. Ação: Limpeza › Links quebrados.
4. **Revisar N sem uso**: se houver favoritos sem uso. Ação: Limpeza › Sem uso.
5. **Dar pasta a N favoritos sem categoria**: se houver sem categoria. Ação: tela Sem categoria (com IA, no marco 4).
6. **Backup**: resolvido (✓ "Backup em dia") se o último backup tiver até 7 dias; senão, "Fazer um backup" com a ação **Fazer backup agora**.

O painel mostra os 4 primeiros pendentes e, se sobrar espaço, completa com os resolvidos. O popup mostra só o primeiro pendente.

### 5.6 Qual cópia fica num grupo de duplicados
O seletor **Manter qual cópia** tem três opções. O padrão é a primeira, que é a regra atual de `findDuplicates`:
- **a mais antiga:** menor `dateAdded`; no empate, a da pasta mais funda (regra atual);
- **a da pasta mais específica:** maior profundidade de caminho; no empate, a mais antiga;
- **a mais usada recentemente:** maior `dateLastUsed`; sem registro conta como o mais antigo possível; no empate, a mais antiga.

A escolha do seletor é guardada (seção 6.3). A troca feita à mão num grupo vale até a próxima análise e não é guardada _(Claude)_. A regra "não deixar um grupo sem nenhuma cópia" (`groupsFullySelected`) continua valendo.

## 6. Dados novos (em `chrome.storage.local`)

### 6.1 Resultado do último teste de links
- A chave `linkCheck` guarda `{ checkedAt: number, complete: boolean, results: Record<string, 'ok' | 'quebrado' | 'incerto'> }`, com o endereço normalizado (`normalizeUrl`) como chave.
- Um teste completo **substitui** o resultado anterior, com `complete: true` e `checkedAt` = fim do teste.
- Um teste cancelado no meio guarda o que já foi testado, mesclado sobre o resultado anterior (o novo vale mais), com `complete: false` e `checkedAt` = hora do cancelamento. Isso vale também para o primeiro teste. Os quebrados já encontrados contam em "a revisar". O cartão mostra "teste incompleto · há X", e o passo "Testar os links" continua pendente até um teste completo _(Claude)_.
- Um favorito que não aparece no resultado (novo, ou endereço não testável) conta como "não testado", não como ok.
- Os cartões e as contagens usam esse resultado, comparado com a árvore atual. Se um quebrado foi apagado, ele simplesmente não conta mais.

### 6.2 Data da última exportação
- A chave `lastExportAt: number` é gravada ao exportar um backup em HTML ou JSON.
- A exportação do CSV da estrutura **não** conta como cópia de backup _(Claude)_.

### 6.3 Preferências da Limpeza
- `inactiveDays: number` (padrão 365): o limiar de "sem uso", usado em todas as contagens (seção 5.1) e no popup.
- `keepPolicy: 'antiga' | 'especifica' | 'usada'` (padrão `'antiga'`): o seletor "Manter qual cópia" (seção 5.6).

Esses valores são lidos pelo painel e pelo popup. Uma troca feita no painel atualiza as contagens dele na hora; o popup lê os valores ao abrir. Nenhum deles entra no backup nem no CSV.

## 7. O que fica para o construtor

- A organização dos componentes em `src/ui/` e como compartilhar uma leitura da árvore entre barra lateral, topo e conteúdo.
- Os nomes das funções puras novas em `src/core/` (sugestão: `organizationBreakdown`, `usageBuckets`, `topFolders`, `nextSteps`, `pickKeep`, `parseRoute`/`formatRoute`).
- Os ícones SVG exatos e os valores das cores no tema claro para as peças novas, validados pelo teste de contraste.
- Como o popup carrega o CSS do painel (importar `styles.css` e aplicar o tema antes do primeiro desenho, como o painel faz).
- O texto exato de cada próximo passo e dos estados vazios, seguindo o tom do quadro.
- O comportamento em telas estreitas: a barra lateral empilha acima do conteúdo e os cartões quebram linha, como no quadro. O painel é usado no computador, então basta não quebrar.

## 8. Etapas sugeridas

1. Rotas no `#` (seção 4.7) e as funções puras das contagens (seção 5), com testes.
2. Dados novos em `chrome.storage.local` (seção 6), com o teste de links gravando e a exportação marcando a data.
3. Barra lateral e topo novos, com ícones SVG; o cadeado sai.
4. Visão geral (dashboard).
5. Limpeza guiada, com os duplicados em grupos e o seletor de cópia.
6. Backups, com os cartões, o diálogo Restaurar… e a busca de apagados.
7. Popup.
8. Checklist manual no Chrome, README com capturas novas e atualização de `docs/melhorias.md`.

## 9. Verificação manual (a fazer depois da implementação)

- [ ] As contagens do dashboard, da barra lateral e do popup são iguais entre si e batem com `chrome://bookmarks`.
- [ ] Cada número clicável (dashboard e popup) abre a tela e a aba certas, e recarregar mantém a tela.
- [ ] Limpeza: as abas já chegam calculadas; em Duplicados, trocar o seletor muda as sugestões; trocar à mão um grupo e mover para a Lixeira leva as cópias certas; Desfazer devolve tudo.
- [ ] O teste de links grava o resultado, o cartão mostra "testado há X" depois de recarregar, e cancelar no meio não apaga o resultado anterior.
- [ ] Backups: exportar atualiza "Cópia fora do navegador"; "Achar um favorito apagado" encontra um favorito apagado e o restaura.
- [ ] O popup abre rápido, segue o tema e mostra o próximo passo certo.
- [ ] O tema claro está legível em todas as telas novas.
