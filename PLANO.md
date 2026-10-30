# Organizar Favoritos — Plano e design

Extensão do Chrome para limpar e organizar favoritos. Uso pessoal, código público no GitHub como peça de portfólio.

> Status: **rascunho para aprovação**. Itens marcados como _(decisão do autor)_ foram definidos por Gustavo; os marcados como _(escolha provisória)_ são sugestões que podem ser trocadas.

## 1. Por que existe

Centenas de favoritos nunca mais abertos e outros perdidos que o autor nem sabe que tem. O problema tem duas partes: **limpar** o que morreu e **reencontrar e organizar** o que ficou. Ao mesmo tempo, apagar dá medo: tudo precisa ser reversível.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Achar favoritos sem uso, duplicados e links quebrados, e deixar o autor revisar tudo numa lista rápida.
- Fazer backup automático antes de qualquer mudança, com opção manual, e permitir desfazer.
- Sugerir uma estrutura de pastas por segmento/função, com IA, e permitir categorias criadas à mão.
- Ser simples e funcional: poucas telas, nenhuma configuração obrigatória além da chave de IA.

**Não-objetivos (por enquanto)**
- Publicar na Chrome Web Store. Sincronizar entre dispositivos. Página de nova aba. Backup em nuvem (GitHub, Drive, WebDAV). Categorizar cada favorito novo ao salvá-lo. Suporte oficial a Edge/Firefox.

**Anti-objetivos (seria fracasso mesmo que "funcione")**
- Mover ou apagar algo sem pré-visualização e sem backup prévio.
- Enviar dados para fora sem o autor saber exatamente o quê, para quem e quando.
- Virar clone de ferramentas existentes em vez de uma ferramenta pequena e confiável.

## 3. O que já existe (pesquisa)

Dados autodeclarados nas páginas das lojas e dos repositórios. Nada foi testado.

| Tipo | Soluções | Pontos relevantes |
|---|---|---|
| Limpeza | Bookmarks clean up, Bookmarks Checker, Bookmark Detox | Duplicados, pastas vazias, links quebrados. Relatos de falsos "inalcançáveis" (~40%) e de travar com 30 mil itens. |
| IA | MarkMind, AI Bookmark Organizer, KeepOrganizedAI, Bookmark Genie | Sugerem pastas. MarkMind pede aprovação. KeepOrganizedAI roda local (Ollama) e faz backup antes. Quase todas exigem chave de API. |
| Completa | [TidyMark (PanHywel)](https://github.com/PanHywel/TidyMark), MIT, 227 estrelas | Regras + IA opcional, links quebrados, arquivo por último acesso, backup em GitHub/WebDAV/Drive, nova aba. É a referência mais próxima. |

**Onde este projeto quer ser diferente** (o coração é 1 e 2):
1. Revisão item a item antes de aplicar qualquer proposta da IA.
2. Desfazer de verdade: backup antes de cada operação, restauração de um item ou do todo, e uma Lixeira antes de apagar.
3. Estado "incerto" nos links, para reduzir falsos "quebrados".
4. Adaptador nativo da Anthropic, além do compatível com OpenAI.
5. A IA só recebe título e domínio, nunca a URL completa.
6. Foco: sem nova aba, sem nuvem.

## 4. Decisões

**Do autor**
- React + TypeScript, Manifest V3, só Chrome, uso pessoal.
- Repositório público `GustavoWalien/organizar-favoritos`, pasta `~/organizar-favoritos`.
- Entram juntas: limpeza com backup e organização por pastas com IA.
- IA por chave de API, com dois adaptadores: **Anthropic** e **compatível com OpenAI** (OpenAI, Gemini, Groq, OpenRouter, Ollama). A chave fica só no navegador.
- Backup automático antes de cada mudança + botão manual.
- Pastas sugeridas pela IA, com possibilidade de categorias manuais.
- Documentação em `README.md` e `PLANO.md`.

**Escolhas provisórias (do Claude)**
- Build com **WXT** (alternativa: Vite + CRXJS). Testes com **Vitest**. CSS simples, sem biblioteca de UI. Estado com hooks do React.
- Interface principal em **página completa** da extensão; popup só com atalhos ("Fazer backup", "Abrir").
- Idioma da interface: português. README em português com resumo em inglês.
- Licença MIT.
- Limiar de inatividade padrão: **12 meses**, ajustável.
- Backups em IndexedDB, mantendo os **últimos 20**; exportação em JSON e HTML (formato que qualquer navegador importa).
- Restaurar **nunca sobrescreve**: cria uma pasta "Restaurado em <data>".
- Desenvolvimento em WSL com o Chrome no Windows: carregar o `dist/` pelo caminho `\\wsl.localhost\...` ou copiar a pasta. Detalhe a resolver no marco 0.

## 5. Comportamento

### 5.1 Modelo de segurança (vale para tudo)
Toda operação segue o mesmo fluxo: **plano → pré-visualização → backup → aplicar → registro de desfazer**.
- Um _plano_ é uma lista de operações (mover, apagar, criar pasta) calculada sem tocar nos favoritos.
- O usuário vê o plano, desmarca o que não quer e confirma.
- O backup é gravado antes da primeira alteração. Se o backup falhar, nada é aplicado.
- "Apagar" move para a pasta **Lixeira** (criada pela extensão). Esvaziar a Lixeira é uma ação manual e separada.
- Pastas raiz do Chrome (Barra, Outros, Mobile) nunca são renomeadas, movidas ou apagadas.
- O Chrome pode sincronizar a conta: mudanças aqui chegam aos outros dispositivos. O aviso aparece na primeira execução.

### 5.2 Limpeza
- **Sem uso:** `dateLastUsed` mais antigo que o limiar. Se nunca foi usado, cai para `dateAdded` e o item é marcado "sem registro de uso". O campo existe desde o Chrome 114 e vale para favoritos, não para pastas.
- **Duplicados:** mesma URL normalizada (sem `#fragmento`, sem parâmetros de rastreio como `utm_*`, sem barra final, host em minúsculas). O mais antigo ou o que está numa pasta mais específica fica, o resto vai para o plano.
- **Quebrados:** a página do painel testa as URLs em lote, com concorrência limitada e timeout (não o service worker, que o Chrome pode encerrar no meio da varredura). Resultado:
  - `ok`: 2xx/3xx.
  - `quebrado`: 404 ou 410.
  - `incerto`: qualquer outra coisa (timeout, erro de rede, 401/403/429, 5xx, bloqueio por robô). Nunca entra no plano de exclusão automaticamente.
  - Tenta `HEAD` e, se falhar, `GET`. Ignora `localhost` e endereços privados.
- **Pastas vazias** aparecem como sugestão após a limpeza.
- Tela de revisão: lista com filtros por motivo, seleção em massa, abrir o link antes de decidir.

### 5.3 Backup e restauração
- Automático antes de cada plano aplicado; manual a qualquer momento.
- Cada snapshot guarda a árvore completa, a data e o motivo.
- Exportar: JSON e HTML. Restaurar: tudo (vira pasta nova) ou um item/pasta (volta ao lugar original se a pasta ainda existe, senão na pasta "Restaurados").
- **Desfazer** reverte o último plano aplicado usando o registro de operações.

### 5.4 Organização
1. **Regras locais** (domínio, palavras no título, dicionário de sites conhecidos) resolvem o óbvio sem IA.
2. **IA** recebe o que sobrou e a lista de pastas existentes, e propõe: encaixar em pasta existente ou criar nova (caminho como `Trabalho/Ferramentas`).
3. A proposta aparece como árvore. O usuário aceita, edita nome/destino ou rejeita por pasta e por item.
4. **Manual:** o usuário cria categorias e arrasta links ou define regras ("domínio X → pasta Y"). A IA é opcional.
- A resposta da IA é validada contra um esquema; JSON inválido é descartado e tentado de novo uma vez.

### 5.5 IA
- Interface única `Provider.classify(items, folders) -> proposta`, com dois adaptadores:
  - **Anthropic**: chamada direta do navegador (exige o cabeçalho de acesso direto; confirmar no marco 0).
  - **Compatível com OpenAI**: URL base + chave + modelo, o que cobre OpenAI, Gemini, Groq, OpenRouter e Ollama.
- Só vão **id, título e domínio**, em lotes (~100). Nunca a URL completa, nunca o conteúdo da página.
- Configurações: provedor, URL base, modelo, chave. Botão "testar conexão". A chave fica em `chrome.storage.local`, nunca no repositório nem em logs.
- Pastas marcadas como "ignorar" ficam fora de limpeza e IA _(pode ficar para depois do marco 4)_.
- Observação: assinaturas (Claude Pro, ChatGPT Go) não incluem API; a chave vem do console de cada provedor, com cobrança própria. Confirmar no plano de cada um.

### 5.6 Permissões
- `bookmarks`, `storage`, `unlimitedStorage`.
- Hosts opcionais, pedidos só na hora: `<all_urls>` para testar links; o domínio do provedor de IA ao configurá-lo.
- Sem `history`: o `dateLastUsed` do próprio favorito basta.

## 6. Estrutura sugerida

```
organizar-favoritos/
  README.md  PLANO.md  LICENSE
  src/
    entrypoints/  # páginas da extensão (WXT): painel e popup
    chrome/       # adaptadores finos para as APIs do Chrome
    storage/      # IndexedDB: backups e diário de desfazer
    core/         # lógica pura e testável: normalizar URL, duplicados, plano, desfazer
    ai/           # interface Provider + adaptadores anthropic e openai-compatible
    ui/           # React: Limpeza, Organização, Backups, Configurações
  tests/
  docs/           # capturas de tela, decisões
```

A lógica em `core/` não depende do Chrome, para ser testada com Vitest.

## 7. Roteiro

| Marco | Entrega | Pronto quando |
|---|---|---|
| 0. Base | WXT + React + TS rodando no Chrome; lê a árvore; confirma `dateLastUsed`; chamada de teste ao Anthropic | A extensão carrega e lista os favoritos |
| 1. Backup | Snapshot, exportar JSON/HTML, restaurar | Backup e restauração funcionam com a sua árvore real |
| 2. Limpeza | Sem uso, duplicados, quebrados, revisão, Lixeira, desfazer | Uma limpeza real é feita e desfeita sem perda |
| 3. Organização manual | Regras locais, categorias manuais, mover com plano | Reorganiza um grupo de links à mão. **Entregue** como marca "não mexer", vista Organizar e CSV da estrutura (ver `docs/decisions/0002-marcas-e-csv.md`); regras locais ficam para depois |
| 4. IA | Adaptadores, proposta em árvore, revisão | Uma proposta é gerada e aplicada com os dois provedores |
| 5. Portfólio | README com capturas, CI, release `.zip` | Um recém-chegado instala e entende em 5 minutos |

Testes: Vitest para `core/` e `ai/` (parsing e validação), checklist manual para a interface e para o fluxo real no Chrome.

## 8. Riscos

- **Falsos "quebrados":** mitigado pelo estado "incerto" e por nunca excluir `incerto` sozinho.
- **Qualidade da IA com modelos pequenos:** classificar por título e domínio é fácil; propor uma estrutura coerente é mais difícil. Testar no marco 4 com mais de um modelo.
- **Sincronização do Chrome:** mudanças se propagam. Backup e Lixeira são a proteção.
- **Muitos favoritos:** lotes e concorrência limitada; testar com a coleção real.
- **Chave de API:** vive no navegador do autor; nunca no código, nos logs nem no repositório público.

## 9. Em aberto (a resolver durante a construção)

- Nome de exibição na loja interna do Chrome (o repositório já é `organizar-favoritos`).
- Se vale o recurso "ignorar pastas" já no marco 2.
- Formato exato do esquema de resposta da IA.
