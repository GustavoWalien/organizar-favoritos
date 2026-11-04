# Melhorias anotadas

Pontos levantados durante os testes manuais. Ficam aqui até serem priorizados e executados.

## Do teste manual de 2026-11-04

| # | Área | Ponto | Origem |
|---|---|---|---|
| 1 | Árvore de pastas | ✅ **Feito** (falta conferir no Chrome). Botões **Expandir tudo** e **Recolher tudo** na árvore lateral. | Pedido do Gustavo (passo 3) |
| 2 | Marca "não mexer" | O ícone e a forma de marcar estão confusos. Provável causa: na barra lateral o botão mostra 🔒 quando a pasta está **livre** e 🔓 quando está **marcada** (mostra a ação, não o estado), e há um segundo 🔒 ao lado do nome. Além disso, a marca existe em dois lugares (barra lateral para pastas, tabela da vista Organizar para tudo). Repensar o controle e o texto. | Gustavo (passo 7) + análise do código (`src/ui/layout/Sidebar.tsx:57-61`) |
| 3 | Marca "não mexer" | Hoje a marca só tem efeito na importação do CSV, então não há como "senti-la" no uso normal. Fazer a Limpeza respeitá-la (já era pendência da decisão 0002) e explicar na interface o que ela protege. | Pergunta do Gustavo (passo 7) |
| 4 | CSV | ✅ **Feito** (falta conferir no Chrome): a importação aceita `file:` (ver decisão 0002); `javascript:`, `chrome:` e afins continuam de fora. Favoritos `file:///` (PDFs locais) são **exportados** mas **rejeitados** na importação ("URL não suportada"). A ida e volta não fecha. Decidir: aceitar `file:` na importação ou deixar de exportar e avisar. Vale também para outros esquemas (`chrome://`, `javascript:`). | Erro do Gustavo (passo 8) — `src/core/structureCsv.ts:159`, `src/core/importPlan.ts:268`, `src/core/url.ts:11` |
| 5 | CSV | ✅ **Feito** (falta conferir no Chrome). A prévia que não encontra nada para importar assusta: "Nada a importar" vem com o título "Linhas do CSV com problema". Deveria dizer claramente que a árvore já está igual ao CSV (quantos itens foram conferidos, nada será alterado) e mostrar as linhas ignoradas como aviso secundário. | Pergunta do Gustavo (passo 8) |

### Em espera

- **Redesenho da marca "não mexer"** (pontos 2 e 3). No redesenho do painel (04/11/2026) o cadeado saiu da barra lateral; a marca continua na vista Organizar e no CSV. Gustavo vai pensar numa forma melhor antes de implementar. Os passos 7 (marca e herança) e 9 (restaurar backup com marcas) do roteiro de teste ficam para depois disso.

## Do redesenho do painel (revisão e teste no Chromium, 2026-11-04)

| # | Área | Ponto | Origem |
|---|---|---|---|
| 6 | Limpeza | A lista de "Sem uso", "Links quebrados" e "Pastas vazias" ainda usa o visual antigo (cartões altos com "abrir" ao lado do título) e não mostra a data do último uso. Deixar no estilo das linhas de duplicados, com a data. | Teste no Chromium |
| 7 | Limpeza | Em Duplicados, depois de "Desmarcar todos" não há "Marcar todos" para voltar. | Revisão final |
| 8 | Limpeza | Dá para iniciar dois testes de links ao mesmo tempo pelo botão. | Revisão final |
| 9 | Desempenho | O painel (a cada mudança) e o popup (a cada abertura) leem todos os backups inteiros só para saber a data do último. Guardar essa data à parte. | Revisão final |
| 10 | Painel | Os números podem piscar no primeiro instante, até as preferências carregarem; um recálculo pode sobrescrever uma troca de preferência recém-feita. | Revisão final |
| 11 | Backups | "Achar um favorito apagado" trata o que está na Lixeira como "ainda existe"; e exportar sem sucesso não mostra mensagem. | Revisão final |
| 12 | Rotas | `#/xyz` não é corrigido na barra de endereço; `#/pasta/<id da Lixeira>` abre a Lixeira como pasta comum. | Revisão final |
| 13 | Popup | Com zero favoritos, "Testar os links" aparece como próximo passo. | Revisão final |
