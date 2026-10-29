# Novo painel (dashboard) — design

Substitui a interface atual (abas simples) por um painel escuro, limpo e funcional, com barra lateral de pastas, resumo clicável e arrastar-e-soltar. A lógica já pronta em `src/core/` (planos, backup, desfazer, limpeza, restauração) é **mantida**; o que muda é a interface e algumas regras de backup.

> Status: **layout aprovado** (mockup v3, 29/10/2026). _(Autor)_ = decidido por Gustavo na conversa. _(Claude)_ = escolha provisória, pode ser trocada.

## 1. Por que

A interface atual é uma lista crua de botões e abas: feia, difícil de trabalhar e sem ligação visual entre pastas, problemas e favoritos. O autor quer **ver o resumo dos favoritos, navegar pelas pastas e categorizar arrastando**, com um visual bonito, simples e escuro. Esse layout também deve abrir caminho para as próximas funções (organização manual, IA) e ajudar a tratar bugs hoje reportados.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Um painel em que, ao abrir, se entende o estado dos favoritos em segundos (resumo) e se chega a qualquer pasta em um clique.
- Mover favoritos para pastas **arrastando**, com efeito imediato e **Desfazer**.
- Os problemas (sem uso, quebrados, duplicados) aparecem como números clicáveis que levam à lista filtrada, reaproveitando a limpeza atual.
- Tema **Claro / Escuro / Sistema**, com padrão Escuro.
- Continuar seguro: nenhuma mudança sem poder desfazer; backup preservado.

**Não-objetivos (nesta entrega)**
- IA de sugestão de pastas (marco 4); o botão "Sugerir pastas" aparece **desabilitado** com a legenda "em breve".
- Regras automáticas de categorização, publicação na loja, sincronização, versão mobile.

**Anti-objetivos**
- Uma tela bonita que perde a segurança: arrastar não pode apagar, sobrescrever ou deixar de ser desfeito.
- Uma tela que trava com milhares de favoritos.
- Interface que só funciona com mouse (precisa de alternativa por teclado/menu).

## 3. Estrutura da tela

**Barra lateral** _(Autor)_
- Visão geral · Limpeza (com contador de itens a revisar) · Backups.
- Seção **Pastas**: árvore **recolhível** com contagem por pasta (soma da subárvore), "+ nova", "Sem categoria" e **Lixeira** (com contador). A pasta de destino de um arraste realça enquanto o favorito passa por cima.
- _(Claude)_ A seção Pastas junta as subpastas da Barra de favoritos, de Outros favoritos e de Mobile. "Sem categoria" são os links que estão **direto** dentro dessas três pastas raiz, fora de qualquer subpasta.

**Topo** _(Autor aprovou o mockup v3)_
- Caminho da pasta atual, busca/paleta **Ctrl K**, alternador de visualização **Lista / Cards / Compacto**, seletor de tema **☀ ◐ ☾** e o botão "✨ Sugerir pastas · em breve" (desabilitado).

**Resumo** (na Visão geral)
- Quatro cartões: **favoritos**, **sem uso**, **quebrados**, **duplicados**. Os três últimos são clicáveis e abrem a Limpeza já com a análise correspondente. "Quebrados" mostra "testar links" até haver resultado, porque exige requisições de rede.

**Conteúdo**
- **Lista é o padrão** (densa): alça ⋮⋮, caixa de seleção, nome com etiquetas (sem uso, duplicado, quebrado), endereço e último uso. Cards e Compacto são alternativas.
- **Barra de seleção** quando há itens marcados: "N selecionados · Mover para… · Lixeira · Limpar".
- Vistas **Limpeza** e **Backups** continuam com as funções atuais, no novo visual.

## 4. Interações

- **Arrastar e soltar** _(Autor)_: soltar um item (ou toda a seleção, se o item arrastado estiver selecionado) numa pasta da barra lateral move **na hora**; aparece "N favoritos movidos para <pasta> · Desfazer" por 10 segundos, e o aviso fica enquanto o mouse está sobre ele. `Esc` cancela o arraste. Cada arraste é um plano no diário; "Desfazer" desfaz o mais recente.
- **Sem arrastar** _(pesquisa)_: **Mover para…** na barra de seleção e na paleta, com busca de pastas; funciona no teclado e no trackpad.
- **Paleta Ctrl K** _(pesquisa)_: busca favoritos (título/endereço) e pastas, e executa ações ("Mover 'X' para…", "Fazer backup agora", "Analisar sem uso"). A busca ignora acentos e maiúsculas.
- **Nova pasta** _(Claude)_: "+ nova" cria a pasta dentro da selecionada, ou em Outros favoritos se nenhuma estiver selecionada.
- Só **links** são arrastáveis nesta entrega; pastas não.
- **Limpeza** mantém a confirmação para mover à Lixeira e a confirmação forte para esvaziar a Lixeira.

## 5. Backup com arrastes frequentes

Como cada arraste é um plano com backup, 20 arrastes encheriam o histórico e apagariam o backup original. Regras _(autor aprovou a ideia; os detalhes são Claude)_:
- Planos aplicados em sequência compartilham **um** backup automático: ele é feito no primeiro e outro só após **10 minutos** sem mudanças.
- Backups **manuais** nunca são apagados automaticamente.
- Os backups automáticos continuam limitados aos **últimos 20**.
- O "Desfazer" continua por plano, independente do backup.

## 6. Visual

- **Tema** _(Autor)_: Claro, Escuro e Sistema, escolhido no topo e guardado no navegador; padrão Escuro. Aplicado antes de desenhar a página, para não piscar.
- **Pesquisa aplicada**: evitar preto puro; profundidade por tom da superfície e por borda, não por sombra; destaques menos saturados; texto com contraste mínimo AA (4,5:1); alça visível nos itens arrastáveis.
- **Tokens do tema escuro** _(Claude, validados por contraste)_: base `#14171d`, barra lateral `#181c23`, superfície `#1d222b`, elevada `#232b3d`, borda `#2c333f`; texto `#e8eaed`, secundário `#a0a8b5`, terciário `#8f98a6`; botão primário `#4a67d8` com texto branco (≥ 4,5:1), link `#9fb4ff`; alertas: sem uso `#f0b45a` sobre `#2a2113`, quebrado `#f0968d` sobre `#2c1a1c`, duplicado `#7bd8a3` sobre `#14291f`.
- **Tema claro**: mesma estrutura com tons claros, a definir e validar pelo mesmo teste de contraste.
- Os tokens ficam em código (TypeScript) e um teste automatizado confere os pares de contraste dos dois temas.
- Tipografia do sistema, cantos de 8 a 14 px, sem biblioteca de componentes.

## 7. Restrições

- Mantém a stack: React + TypeScript + WXT, CSS próprio, sem biblioteca de UI.
- Arrastar com a API nativa de arrastar-e-soltar do navegador _(Claude)_, sem dependência nova.
- Desempenho: cards em janelas (virtualização simples ou paginação) e árvore de pastas com contagens calculadas uma vez por leitura.
- Toda mudança de favoritos continua passando por `runPlan` (backup → aplicar → diário).

## 8. O que fica para o construtor

- Organização dos componentes dentro de `src/ui/`.
- Como compartilhar a árvore lida entre barra lateral e conteúdo sem leituras duplicadas.
- Valores finais do tema claro.
- Referências consultadas: [Raindrop.io (modos de visualização)](https://help.raindrop.io/ui), [boas práticas de modo escuro](https://atmos.style/blog/dark-mode-ui-best-practices), [UX de arrastar e soltar](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/), [acessibilidade em arrastar e soltar](https://www.continualengine.com/blog/drag-and-drop-accessibility/). Eram páginas de divulgação e blogs; os números são referência, não regra. O tempo do aviso de desfazer (10 s) é escolha do projeto, sem fonte.
- Os erros que o autor encontrou no teste serão tratados **depois** da entrega do layout, e podem alterar telas específicas.

## 9. Etapas sugeridas

1. Tokens e tema Claro/Escuro/Sistema + estrutura (barra lateral e topo) com as vistas atuais encaixadas.
2. Pastas: árvore com contagens, abrir pasta, lista com os três modos, busca.
3. Visão geral com resumo clicável.
4. Seleção, "Mover para…" e aviso com Desfazer, com a regra de backup compartilhado.
5. Arrastar e soltar.
6. Paleta Ctrl K.
7. Limpeza, Backups e Lixeira no novo visual; acessibilidade; revisão final e README com capturas.
