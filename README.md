# Organizar Favoritos

Extensão do Chrome para **limpar e organizar os favoritos** sem medo de perder nada: toda mudança passa por pré-visualização, backup automático, Lixeira e desfazer.

Projeto pessoal, feito para resolver um problema real: centenas de favoritos que nunca mais foram abertos e outros tantos esquecidos.

> **English summary:** a personal Chrome extension (Manifest V3, React + TypeScript + WXT) that finds unused, duplicate and broken bookmarks, lets you review them, and moves them to a Trash folder, always taking a backup first and keeping an undo journal. AI-assisted folder suggestions are planned.

## Status

| Marco | O que entrega | Estado |
|---|---|---|
| 0. Base | Esqueleto WXT + React + TS, leitura dos favoritos | Pronto |
| 1. Backup | Snapshots, exportar JSON/HTML, restaurar | Pronto |
| 2. Limpeza | Sem uso, duplicados, links quebrados, Lixeira, desfazer | Pronto |
| 3. Organização | Marca "não mexer", vista Organizar e CSV da estrutura | Pronto (falta verificar na interface) |
| 4. IA | Sugestão de pastas (Anthropic e compatível com OpenAI), revisão e aplicar | Pronto (falta testar com chave real) |
| Redesenho | Dashboard, Limpeza guiada, Backups, popup com resumo | Pronto (falta verificar na interface) |
| 5. Acabamento | Capturas de tela, CI, release | Planejado |

Os marcos 0 a 3 e o redesenho têm testes automatizados da lógica (406 testes). A interface ainda precisa de uma rodada de verificação manual no Chrome; os checklists estão em [`docs/decisions/0000-stack.md`](docs/decisions/0000-stack.md) e [`docs/decisions/0002-marcas-e-csv.md`](docs/decisions/0002-marcas-e-csv.md).

## O que ela faz

**Painel e popup**
- **Visão geral (dashboard):** quanto dos favoritos já está em pastas, quantos estão sem uso, duplicados ou quebrados, os **próximos passos** em ordem, as maiores pastas, quando cada favorito foi usado e a atividade recente com Desfazer. Cada número leva à tela que resolve aquilo.
- **Popup do ícone:** o mesmo resumo em miniatura, com o próximo passo e atalhos que abrem o painel já na tela certa.
- Cada tela tem endereço próprio (`dashboard.html#/limpeza/duplicados`, por exemplo): recarregar não perde o lugar.

**Limpeza**
- **Sem uso:** favoritos que não são abertos há mais de N dias (padrão 365), usando o `dateLastUsed` do Chrome. Quando o Chrome não guardou o último uso, vale a data em que o favorito foi adicionado e o item é marcado como "sem registro de uso".
- **Duplicados:** compara URLs normalizadas (sem `#fragmento`, sem `utm_*`/`fbclid`/`gclid`, parâmetros ordenados) e mostra os grupos com a cópia que fica já marcada: a mais antiga, a da pasta mais específica ou a mais usada, à escolha, com troca manual por grupo. Nunca deixa mover todas as cópias de um grupo.
- **Links quebrados:** testa os endereços com concorrência limitada e três resultados: `ok`, `quebrado` (só 404 ou 410) e `incerto` (timeout, bloqueio, 401/403/429, 5xx). Itens só "incertos" nunca vêm marcados.
- **Pastas vazias.**
- A Limpeza abre já analisada, em quatro abas com contagem. O resultado do teste de links fica guardado, e o limiar de "sem uso" escolhido vale para todas as telas.

**Organização**
- **Não mexer:** marca favoritos e pastas que devem ficar onde estão. Pasta marcada protege tudo o que está dentro dela (a caixa dos itens herdados aparece marcada e travada). A marca vive na extensão, não no Chrome, e vai junto nos backups. Hoje ela só é respeitada pela importação do CSV (que não move um item protegido); você ainda pode mover o item à mão. **A Limpeza (sem uso, duplicados, pastas vazias) ainda não considera a marca:** um item marcado pode aparecer na revisão, e "Selecionar todos" → Lixeira o move junto. A marca foi pensada para as propostas automáticas que vêm depois (regras, IA).
- **Vista Organizar:** tabela com todos os favoritos, pasta atual e a caixa "Não mexer", com filtros (só soltos, só marcados, por pasta, busca sem acento) e marcação em massa.
- **Exportar e importar a estrutura em CSV:** o CSV leva pastas, favoritos e marcas, e serve para levar a árvore a outro navegador ou conferir numa planilha. A importação mostra uma **prévia** (criados, movidos, marcas alteradas, linhas ignoradas) e deixa desmarcar o que não quer. Ela só cria e move, nunca remove, faz um backup próprio antes e tem **Desfazer**. A Lixeira da extensão não vai no CSV, e linhas dentro dela são ignoradas na importação. Pastas irmãs com o mesmo nome viram uma só ao importar em outro navegador. Para abrir no Google Planilhas: **Arquivo → Importar → Upload**.

**Sugestões da IA**
- Escolha o que organizar (sem categoria, dentro de uma pasta ou tudo) e o provedor: **Anthropic** (padrão Claude Opus 5.5) ou **compatível com OpenAI** (OpenAI, Gemini, Groq, OpenRouter, Ollama).
- Antes de enviar, a tela mostra o que sai do navegador: só **título e domínio** de cada favorito e os nomes das pastas, nunca o endereço completo, com uma estimativa de custo. Favoritos "não mexer" e a Lixeira ficam de fora.
- Uma regra local resolve sem IA os favoritos cujo domínio já mora numa pasta.
- A proposta aparece agrupada por pasta (existente ou nova), com motivo e confiança; os de confiança baixa vêm desmarcados. Dá para aceitar por item ou por pasta, mudar o destino e renomear pasta nova. Aplicar faz backup e tem Desfazer.
- A chave fica só no navegador. Assinaturas (ChatGPT, Claude.ai) não servem: é preciso uma chave de API do console do provedor.

**Segurança**
- **Backup antes de cada mudança.** Se o backup falhar, nada é alterado. Guardam-se os últimos 20 no IndexedDB, e dá para fazer um backup manual a qualquer momento.
- **Lixeira:** "apagar" move para uma pasta `Lixeira (Organizar Favoritos)`. Esvaziar é uma ação separada e pede confirmação.
- **Desfazer** do último plano aplicado, com o rótulo e a data do que será revertido.
- **Restaurar nunca sobrescreve:** recria a árvore em `Restaurado em <data>`, ou devolve um item ao lugar de origem.
- **Exportar** em JSON ou em HTML (formato Netscape, que qualquer navegador importa). A tela de Backups mostra há quanto tempo foi a última cópia exportada e acha favoritos apagados em todos os backups para restaurar.
- As pastas raiz do Chrome (Barra, Outros, Mobile) nunca são movidas nem renomeadas.

> O Chrome sincroniza favoritos entre dispositivos: o que for movido aqui chega aos outros. A Lixeira e os backups são a proteção.

## Como funciona

```
plano → pré-visualização → backup → aplicar → registro para desfazer
```

Toda alteração é um **plano**, uma lista de operações (criar pasta, criar link, mover, remover) calculada sem tocar nos favoritos. O `runPlan` grava o backup, aplica as operações uma a uma (uma falha isolada não derruba as outras) e guarda o inverso do que foi aplicado.

A lógica fica em `src/core/`, sem depender do Chrome, e o acesso aos favoritos passa pela interface `BookmarksApi`. Por isso a maior parte do código é testada com um Chrome falso em memória.

```
src/
  entrypoints/   páginas da extensão: painel e popup
  core/          lógica pura e testável (planos, duplicados, links, restauração…)
  chrome/        adaptadores finos para as APIs do Chrome
  storage/       IndexedDB: backups e diário de desfazer
  ui/            componentes React
tests/           testes (Vitest)
docs/decisions/  decisões e medições
PLANO.md         design completo e roadmap
```

## Permissões

- `bookmarks`: ler e reorganizar os favoritos.
- `storage` e `unlimitedStorage`: guardar os backups.
- Acesso a sites (`<all_urls>`) é **opcional** e só é pedido quando você clica em "Testar links", ou, para o domínio do provedor de IA, em "Testar conexão".
- Não usa `history`. Só as Sugestões da IA mandam algo para fora, quando você clica em "Gerar sugestões": título e domínio dos favoritos e nomes de pastas, nunca a URL completa.

## Instalar para usar ou desenvolver

Requisitos: Node.js (desenvolvido com a versão 24) e Chrome.

```bash
npm install
npm run build        # gera .output/chrome-mv3
```

No Chrome: `chrome://extensions` → ativar **Modo do desenvolvedor** → **Carregar sem compactação** → escolher `.output/chrome-mv3`. Depois de cada build, clique em recarregar na extensão.

Se o Chrome roda no Windows e o código no WSL, use o caminho `\\wsl.localhost\<distro>\...\organizar-favoritos\.output\chrome-mv3`. Detalhes em [`docs/decisions/0000-stack.md`](docs/decisions/0000-stack.md).

| Comando | Para quê |
|---|---|
| `npm run dev` | Modo de desenvolvimento do WXT |
| `npm run build` | Build de produção |
| `npm test` | Testes (Vitest) |
| `npm run compile` | Checagem de tipos (`tsc --noEmit`) |
| `npm run zip` | Empacota a extensão |

## Decisões de design

- **Reversibilidade acima de tudo:** o projeto prefere pedir uma confirmação a mais a perder um favorito.
- **"Incerto" em vez de "quebrado":** as extensões de limpeza existentes são criticadas por falsos "inalcançáveis". Aqui só 404/410 contam como quebrado.
- **Sem service worker:** o teste de links roda na página do painel, porque o Chrome pode encerrar o service worker no meio de uma varredura longa.
- **ID fixo da extensão:** o manifesto tem uma `key` pública, para os backups não se perderem se a pasta do build mudar de lugar.
- **Importar só cria e move:** um CSV nunca apaga nem renomeia o que o navegador já tem.
- A pesquisa de soluções existentes e o roadmap completo estão em [`PLANO.md`](PLANO.md).

## Roadmap

1. **Organização (feito):** marca "não mexer", vista em tabela e CSV da estrutura. Regras locais (domínio, palavras no título) podem vir depois.
2. **IA (próximo):** a IA propõe a árvore de pastas e você aprova por pasta e por item. Dois adaptadores: Anthropic e compatível com OpenAI (OpenAI, Gemini, Groq, OpenRouter, Ollama). A chave fica só no navegador.
3. **Acabamento:** capturas de tela, CI e release.

## Licença

[MIT](LICENSE)
