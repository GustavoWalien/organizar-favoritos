# Marco 4: sugestões de pastas com IA — design

A IA propõe uma pasta para cada favorito escolhido. O usuário revisa item a item e aplica pelo fluxo seguro de sempre (backup → aplicar → Desfazer). Este documento detalha as seções 4, 5.4 e 5.5 do [`PLANO.md`](../../../PLANO.md).

> Status: **aprovado** pelo Gustavo em 04/11/2026, a partir das telas 5 e 6 do quadro [Redesenho do painel](https://claude.ai/artifact/2hrh5cvsUFPDNAZhbY7ChL) (linha "Marco 4"). _(Autor)_ = decidido pelo Gustavo. _(Claude)_ = escolha provisória que pode ser trocada. Os números do quadro são de exemplo.

## 1. Por que

O autor tem mais de mil favoritos, alguns soltos, e pastas enormes. Organizar à mão leva tempo demais. A IA resolve o grosso, mas apagar e mover dá medo, então nada acontece sem revisão _(PLANO.md)_.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Gerar, em poucos cliques, uma proposta de pasta para um conjunto de favoritos, com motivo e confiança por item.
- Revisar a proposta agrupada por pasta de destino: aceitar ou recusar por item ou por pasta, mudar o destino, renomear pasta nova.
- Aplicar só o que foi aceito, com backup antes e Desfazer depois.
- Funcionar com dois tipos de provedor: **Anthropic** e **compatível com OpenAI** _(Autor, PLANO.md)_.

**Não-objetivos (nesta entrega)**
- Classificar cada favorito novo no momento em que é salvo.
- Gravar a proposta nas marcas `sugestao`/`aprovado` (e, por elas, no CSV). Fica para depois _(Claude)_.
- Renomear ou mover pastas que já existem. A IA só cria pastas novas e move favoritos.
- Ler o conteúdo das páginas.

**Anti-objetivos**
- Mandar qualquer coisa para fora sem o usuário ver, antes, o quê, para quem e quanto custa.
- Mandar a URL completa, a chave ou qualquer coisa além de título, domínio e nomes de pastas.
- Mover algo que o usuário não aceitou, ou mover um item marcado "não mexer".
- Uma resposta ruim da IA virar operação: o que não passa na validação é descartado.

## 3. Restrições

- Mesma stack (React 19 + TypeScript + WXT, CSS próprio, Vitest). **Uma dependência nova:** `@anthropic-ai/sdk`, usada só no adaptador Anthropic _(Claude: é o SDK oficial e funciona no navegador)_. O adaptador compatível com OpenAI usa `fetch`, sem SDK.
- Tudo roda na página do painel. Não há servidor, e a chave fica só no navegador.
- A chave fica em `chrome.storage.local`, nunca no código, em logs ou no repositório. Na tela, aparece mascarada (só os 4 últimos caracteres).
- Permissão de host: a extensão já declara `optional_host_permissions: ['<all_urls>']`. Ao salvar ou testar um provedor, pede só a origem dele (`https://api.anthropic.com/*` ou a da URL base), no clique.
- Toda mudança nos favoritos passa por `runPlan`. A IA só produz dados, e o plano é montado pela extensão.
- Interface em português do Brasil, temas claro, escuro e sistema, padrões do redesenho (barra lateral, cartões, barra de ação fixa).

## 4. Telas

### 4.1 Entrada

- A entrada **"Sugestões da IA"** da barra lateral passa a funcionar (sem "breve"), com a rota `#/ia`.
- O botão "Sugerir pastas com IA" do dashboard passa a funcionar e abre `#/ia`.
- O passo "Dar pasta a N favoritos sem categoria" ganha o botão "Sugerir com IA", que abre `#/ia` com o escopo "Sem categoria".
- Se existe uma proposta guardada, `#/ia` abre direto na revisão (4.4).

### 4.2 Escolher e enviar — quadro, tela 5

Três cartões:

1. **O que organizar** (rádio):
   - **Sem categoria** (padrão): os favoritos soltos nas raízes.
   - **Dentro de uma pasta**: um seletor de pasta (`folderOptions`). Entram os favoritos da subárvore, e as pastas candidatas são as que existem dentro dela, mais pastas novas criadas dentro dela.
   - **Todos os favoritos**.
   - A caixa **"Pode criar pastas novas"** vem marcada. Desmarcada, a IA só pode usar pastas existentes.
   - O texto "Ficam de fora: os marcados 'não mexer' e a Lixeira" fica sempre visível.
2. **Provedor:**
   - Botões Anthropic e Compatível com OpenAI.
   - **Anthropic:** chave e modelo (Claude Opus 5.5, o padrão _(Autor)_; Claude Sonnet 5.5; Claude Haiku 5.5, o mais barato).
   - **Compatível com OpenAI:** URL base (por exemplo `https://api.openai.com/v1`), chave (opcional, porque o Ollama não usa) e nome do modelo, em texto livre.
   - **Testar conexão:** pede a permissão do host, faz uma chamada mínima e mostra "Conectado" ou o erro traduzido (seção 7).
   - A configuração é guardada ao testar com sucesso.
3. **O que vai ser enviado:**
   - Uma frase com a quantidade de favoritos, "só título e domínio, nunca o endereço completo", a quantidade de pastas cujos nomes vão junto, o provedor e o modelo.
   - O número de lotes e uma faixa de custo estimado (seção 6.4), com o aviso "cobrado na sua conta do provedor".
   - Quantos favoritos já têm pasta pela regra de domínio (seção 5.2) e não vão para a IA.
   - O botão principal **Gerar sugestões** fica desabilitado sem provedor configurado ou sem favoritos.

**Durante a geração:** a barra mostra o progresso por lote ("Lote 2 de 11"), com **Cancelar**. Ao cancelar, o que já voltou vira proposta parcial e pode ser revisado.

### 4.3 Configuração na prática

Não há tela de configurações separada: o cartão "Provedor" é a configuração _(Claude)_. A configuração guardada também aparece resumida ("Anthropic · Claude Opus 5.5 · chave …3f9a"), com "Trocar".

### 4.4 Revisar e aplicar — quadro, tela 6

**Cabeçalho:** "Revisar sugestões", com escopo, quantidade, modelo e "gerado há X". O texto avisa que a proposta fica guardada até aplicar ou descartar. Há dois filtros:
- **Só baixa confiança**;
- **Recolher pastas** / **Expandir pastas**.

**Um cartão por pasta de destino:**
- O cabeçalho tem:
  - caixa para aceitar a pasta inteira (fica em estado indeterminado com seleção parcial);
  - caminho completo ("Barra › Developer › Tools Dev");
  - etiqueta **existente** ou **nova**;
  - quantidade;
  - **Renomear**, só em pasta nova. Muda só o último nome, para todos os itens dela. Se o nome novo coincidir com uma pasta irmã existente ou com outra pasta nova da proposta, os grupos se juntam, e a etiqueta passa a "existente" quando for o caso _(Claude)_.
- Cada item tem:
  - caixa de aceitar;
  - título e domínio;
  - motivo (curto, vindo da IA, ou "regra: domínio já está aqui");
  - etiqueta de confiança: **alta**, **média** ou **baixa**;
  - **Mudar pasta**, que abre o `MovePicker` (o mesmo componente, recebendo a lista de opções) com as pastas candidatas do escopo e as novas da proposta. Não dá para digitar pasta nova aqui nesta entrega _(Claude)_.

**Seleção inicial:** os itens de confiança **baixa** vêm **desmarcados**, e os demais, marcados _(Claude)_.

**Itens sem mudança:** um favorito cuja pasta sugerida é a pasta onde ele já está não aparece como mudança. Vai para uma linha recolhida "N já estão no lugar certo".

**Barra de ação fixa:**
- "N de M aceitos · K pastas novas · R recusados ficam onde estão";
- **Descartar proposta**, com confirmação;
- **Aplicar N** (principal).

**Aplicar:**
- Monta um plano: `create-folder` para cada pasta nova com pelo menos um item aceito (ancestrais antes), e `move` para cada item aceito.
- Confirma, roda `runPlan` com backup próprio (`shareBackup: false`, como a importação do CSV) e mostra o aviso com **Desfazer**.
- Apaga a proposta guardada.
- Antes de aplicar, a extensão relê a árvore e as marcas. Ficam de fora, contados como "N mudaram desde a sugestão":
  - item que sumiu, mudou de pasta desde a geração ou ganhou "não mexer";
  - item cuja pasta de destino (existente) sumiu ou ganhou "não mexer".

## 5. Comportamento

### 5.1 O que entra

- Os links do escopo, fora da Lixeira e **sem proteção efetiva** (`isProtectedEffective` em `src/core/marks.ts`).
- Só links de `http(s)` são enviados. Os de `file:`, `javascript:` e semelhantes ficam de fora, com contagem.
- Se o escopo ficar vazio, o botão fica desabilitado com o motivo.

### 5.1b Pastas candidatas (destinos possíveis)

- São as pastas existentes onde um favorito pode ir, cada uma com um **número** (`k`) no pedido. A IA responde com o número, nunca com o nome. Assim, pastas irmãs de mesmo nome, ou nomes com "/", não se confundem. A proposta guarda o **id real** da pasta de destino _(Claude)_.
- **Ficam de fora das candidatas:**
  - pastas com proteção efetiva "não mexer": não recebem favoritos, para o conteúdo delas não mudar;
  - a Lixeira e tudo dentro dela;
  - no escopo "Dentro de uma pasta", tudo o que está fora da pasta escolhida.
- **Raízes:** Barra e Outros entram como candidatas só como **pai de pasta nova**, nunca como destino final. Um favorito sugerido para "Barra" sem pasta nova ficaria solto e é tratado como "sem sugestão". Mobile não entra como candidata _(Claude)_.

### 5.2 Regra local de domínio (antes da IA)

- **Só no escopo "Sem categoria"** _(Claude)_. Em "Dentro de uma pasta" e "Todos", o objetivo é reorganizar, e a regra prenderia cada favorito à pasta onde ele já está. Nesses dois escopos, todos os itens vão para a IA.
- Os favoritos protegidos não contam como evidência.

- Para cada favorito, olha os **outros** favoritos do mesmo domínio (`domainOf`, sem `www.`) que estão em pastas candidatas.
- Se uma pasta concentra **pelo menos 2** desses favoritos **e** pelo menos 60% deles, ela vira a sugestão. A fonte é `regra`, a confiança é `alta` e o motivo é "regra: domínio já está aqui" _(Claude)_.
- Os itens resolvidos pela regra **não vão para a IA**.

### 5.3 Pedido para a IA

**Lotes** de até 100 favoritos _(PLANO.md)_. Cada pedido leva:
- as **pastas candidatas** (seção 5.1b), como linhas `k: Barra › Developer › Tools Dev`, com os nomes das raízes trocados por tokens fixos (`Barra`, `Outros`), iguais em todos os lotes, para aproveitar o cache de prompt;
- os **favoritos** do lote: `{ "i": <número do item no lote>, "t": <título>, "d": <domínio> }`. O `i` é local ao lote, então o id do Chrome não sai do navegador _(Claude)_;
- a **regra de pastas novas**: se é permitido criar e onde. Uma pasta nova fica sempre abaixo de uma candidata (em "Sem categoria" e "Todos", pode ser abaixo de Barra ou Outros; em "Dentro de uma pasta", abaixo da pasta escolhida ou de uma subpasta dela). Tem no máximo 2 níveis abaixo dessa candidata.

**Pastas novas criadas num lote** são acrescentadas às candidatas dos lotes seguintes, já com número. Assim, dois lotes não inventam "Finanças" e "Financeiro" _(Claude)_.

**Instruções do sistema** (texto fixo, em português):
- usar uma pasta existente quando couber;
- criar pastas novas só quando um grupo de itens justificar, com nomes curtos em português, no máximo 2 níveis abaixo do ponto permitido;
- dar um motivo de até 6 palavras;
- marcar confiança `baixa` quando o título é vago.

**Resposta esperada** (validada pelo esquema da seção 6.2):

```json
{ "itens": [
  { "i": 0, "pasta": 12, "nova": "", "confianca": "alta", "motivo": "ferramenta de dev" },
  { "i": 1, "pasta": 0, "nova": "Finanças", "confianca": "media", "motivo": "controle financeiro" }
] }
```

`pasta` é o número de uma candidata. `nova` vazio significa mover para essa candidata. `nova` preenchido significa criar abaixo dela o subcaminho dado, com até 2 nomes separados por ` / `.

### 5.4 Validação da resposta (função pura, testada)

- O JSON tem de bater com o esquema. Se não bater, o lote é **refeito uma vez**. Se falhar de novo, o lote é marcado com erro e os itens dele ficam sem sugestão.
- `i` fora do lote ou repetido: o item é ignorado.
- Itens do lote que não vieram na resposta ficam sem sugestão e são contados ("5 sem sugestão").
- `pasta` fora da lista de candidatas: o item fica sem sugestão.
- `nova`:
  - é dividido por ` / `; cada nome tem os espaços das pontas removidos e é cortado em 60 caracteres; nomes vazios são descartados;
  - mais de 2 nomes: ficam os 2 primeiros;
  - se o primeiro nome coincide com uma subpasta existente da candidata (sem diferenciar maiúsculas nem acentos), o item vai para essa subpasta, e o resto continua como novo;
  - com criar proibido, um `nova` que não resolve para pasta existente deixa o item sem sugestão.
- Uma raiz como destino final (sem `nova`): o item fica sem sugestão.
- O destino nunca pode ser a Lixeira, nem estar dentro dela (já garantido pelas candidatas).
- `motivo` é cortado em 60 caracteres. `confianca` desconhecida vira `baixa`.

### 5.5 Proposta guardada

Fica em `chrome.storage.local`, na chave `aiProposal`:

```ts
{
  createdAt, provider, model,
  scope: { kind: 'sem-categoria' | 'pasta' | 'todos', folderId? },
  allowNew,
  items: [{ id, title, domain, fromFolderId, target: { folderId, newPath: string[] }, confidence, reason, source: 'ia' | 'regra', accepted }],
  failedBatches,
}
```

- O `id` e o `folderId` são ids reais do Chrome, guardados só localmente. `target.folderId` é a pasta existente de destino, e `target.newPath` são os nomes a criar abaixo dela (vazio = mover direto para ela). Duas sugestões com o mesmo `folderId` e o mesmo `newPath` são a mesma pasta nova.
- Uma geração nova substitui a proposta anterior, depois de confirmação se houver itens não aplicados.
- Validação ao ler, como nas outras preferências: um formato inválido vira "sem proposta".

### 5.6 Chamadas por provedor

**Anthropic** (`@anthropic-ai/sdk`):
- O cliente usa `dangerouslyAllowBrowser: true`, que é o modo do SDK para rodar no navegador com a chave do próprio usuário.
- Modelo padrão: `claude-opus-5-5` _(Autor)_, com `output_config: { effort: 'low', format: { type: 'json_schema', schema } }` _(Claude: classificar é tarefa simples; o Opus 5.5 não permite desligar o raciocínio, então o esforço baixo é o controle de custo)_.
- `max_tokens` de cerca de 8.000 por lote.
- Recusa: usa `fallbacks: 'default'` com a beta `server-side-fallback-2026-07-01` (`client.beta.messages`), recomendação atual para o Opus 5.5. Se ainda assim vier `stop_reason: 'refusal'`, o lote é marcado com erro.
- Cache de prompt nas instruções e na lista de pastas, que se repetem entre lotes.

**Compatível com OpenAI** (`fetch` em `<base>/chat/completions`):
- `Authorization: Bearer <chave>` quando há chave.
- `response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } }`. Se o provedor recusar esse campo (400), tenta de novo com `{ type: 'json_object' }` e as instruções pedindo o formato.
- A validação da seção 5.4 vale igual.

**Interface única** em `src/ai/`: `Provider.classify(batch, contexto, signal) → resposta crua validada` e `Provider.test(signal) → ok | erro`.

## 6. Custos, esquema e limites

### 6.1 Concorrência

Um lote de cada vez _(Claude: evita estourar o limite de uso de contas novas e deixa o progresso claro)_.

### 6.2 Esquema JSON da resposta

- Objeto com `itens`, uma lista de objetos com `i` (inteiro ≥ 0), `pasta` (string, 1 a 200 caracteres), `nova` (boolean), `confianca` (`alta`, `media` ou `baixa`) e `motivo` (string).
- Todos os campos são obrigatórios e `additionalProperties: false`.
- Na interface, `media` aparece como "média".

### 6.3 Tamanho

- Títulos com mais de 200 caracteres são cortados antes do envio.
- A lista de pastas candidatas vai inteira. Se passar de 1.500 pastas, vão só as 1.500 mais rasas, e a tela avisa _(Claude)_.

### 6.4 Estimativa de custo (mostrada antes de enviar)

- Por lote, estima os tokens de entrada (instruções, mais as pastas, mais cerca de 25 tokens por favorito) e de saída (cerca de 40 tokens por favorito, mais uma folga para o raciocínio no Opus), e multiplica pelo preço do modelo.
- Para a Anthropic, a tabela de preços fica numa constante no código, com a data da tabela.
- Para o compatível com OpenAI, o texto é "custo depende do provedor", sem número.
- A faixa mostrada é "abaixo de US$ X", arredondada para cima.

## 7. Erros (mensagens)

| Situação | Mensagem | O que acontece |
|---|---|---|
| 401/403 | "A chave foi recusada pelo provedor. Confira a chave e o plano da conta." | para tudo |
| 404 de modelo | "O modelo '<nome>' não existe nesse provedor." | para tudo |
| 429 | "Limite de uso do provedor atingido. Tentando de novo em X s." | espera e tenta (SDK: até 2 novas tentativas; fetch: o mesmo, respeitando `retry-after`). Depois disso, para, e o que já voltou fica como proposta parcial |
| 5xx / sobrecarga (529) | "O provedor está sobrecarregado. Tentando de novo…" | igual ao 429 |
| Rede ou sem permissão do host | "Não foi possível falar com o provedor. A extensão tem permissão para acessar <origem>?" | para tudo |
| Resposta inválida duas vezes | "Um lote voltou com resposta inválida." | lote marcado com erro, o resto continua |
| Recusa | "O provedor recusou um lote." | lote marcado com erro, o resto continua |

Nenhuma mensagem mostra a chave.

## 8. O que fica para o construtor

- Organização de `src/ai/` (adaptadores, montagem do prompt, validação) e dos componentes da tela.
- O texto exato das instruções do sistema, dentro do que a seção 5.3 pede.
- Como o painel guarda o estado da geração em andamento (hook próprio, como `useDashboard`).
- Ícones e detalhes de layout, seguindo o quadro e o CSS existente.
- Os testes de adaptador usam um `fetch` falso ou um cliente falso. Nenhum teste automatizado chama um provedor de verdade.

## 9. Etapas sugeridas

1. Escopo, regra de domínio e montagem dos lotes (funções puras).
2. Esquema e validação da resposta (função pura).
3. Configuração do provedor guardada, com permissão de host.
4. Adaptador Anthropic (SDK) e adaptador compatível com OpenAI (`fetch`), atrás da interface única.
5. Geração com progresso e cancelamento, e a proposta guardada.
6. Montagem do plano a partir da proposta (pastas novas, moves, revalidação antes de aplicar).
7. Tela de início (4.2) e tela de revisão (4.4), ligadas à rota `#/ia`, à barra lateral, ao dashboard e ao passo de sem categoria.
8. Verificação: teste no Chromium do WSL com um provedor falso, e com o Gustavo usando a chave real.

## 10. Verificação manual (depois da implementação)

- [ ] Configurar a Anthropic com a chave real, testar a conexão e ver a permissão do host ser pedida só para `api.anthropic.com`.
- [ ] Gerar sugestões para "Sem categoria". Conferir que o texto de envio bate com o que saiu: só título e domínio, sem URL.
- [ ] Revisar: os de confiança baixa vêm desmarcados; mudar pasta; renomear pasta nova; aceitar a pasta inteira.
- [ ] Aplicar: backup criado, pastas novas criadas, favoritos movidos; Desfazer devolve tudo.
- [ ] Cancelar no meio de "Todos": a proposta parcial pode ser revisada.
- [ ] Repetir com um provedor compatível com OpenAI (uma chave de API da OpenAI ou outro provedor; **a assinatura do ChatGPT Go não dá acesso à API**).
- [ ] Item marcado "não mexer" nunca aparece na proposta.
