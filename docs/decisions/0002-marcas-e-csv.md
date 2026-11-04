# 0002 — Marcas "não mexer" e CSV da estrutura

Decisões do marco 3 (marcação, vista Organizar e CSV). O design completo está em [`docs/superpowers/specs/2026-10-30-marcacao-e-csv-design.md`](../superpowers/specs/2026-10-30-marcacao-e-csv-design.md).

## Por que as marcas ficam na extensão

O Chrome não permite campos extras em favoritos. A marca "não mexer" (e, para a IA futura, `sugestao` e `aprovado`) fica no IndexedDB da extensão, no object store `flags`, com o ID do favorito ou da pasta como chave. O banco subiu de versão para criar o store; o snapshot do backup passou a levar as marcas, e restaurar um backup as recria ligadas aos novos IDs. Backups antigos, sem o campo, continuam válidos.

A marca não impede o usuário de mover o item à mão. Ela foi pensada para proteger contra as propostas automáticas que vêm depois (regras, IA). Hoje só a importação do CSV a respeita: não move um item protegido.

**A Limpeza ainda não considera a marca.** As varreduras de sem uso, duplicados e pastas vazias listam itens marcados como qualquer outro, e "Selecionar todos" → Lixeira os move junto. Passar a respeitar a marca na Limpeza fica para depois.

O banco subiu da versão 1 para a 2 para criar o store `flags`, e a subida não tem volta: um build antigo da extensão (que ainda abre a versão 1) recebe `VersionError` ao abrir o banco depois que um build novo o atualizou. Voltar para um build antigo exige apagar os dados da extensão (e restaurar um backup exportado, se houver).

## Por que a chave do CSV é URL normalizada + raiz + caminho, e não o ID

Os IDs dos favoritos são diferentes em cada navegador, então não servem para levar a estrutura para outro Chrome. A chave de um link é a URL normalizada (`normalizeUrl`) mais a raiz (`barra`, `outros` ou `mobile`) mais o caminho da pasta. A chave de uma pasta é a raiz mais o caminho completo. Dois links iguais em pastas diferentes são linhas diferentes, cada um com a sua marca; dois iguais na mesma pasta são desempatados pela posição entre os iguais daquela pasta.

Antes de casar, as linhas são postas na ordem da árvore pela coluna `ordem` dentro de cada pasta (empate: a ordem do CSV; a pasta vem antes do seu conteúdo). Assim, uma planilha que o usuário ordenou por título ou por URL ainda desempata os duplicados como na exportação e cria os itens novos na ordem original. Se a coluna `ordem` estiver vazia ou faltar, vale a posição da linha no CSV.

Pastas irmãs com o mesmo nome têm a mesma chave. No mesmo navegador (CSV na ordem exportada) elas continuam separadas, desempatadas pela ordem de aparição. Ao importar em outro navegador, porém, viram **uma pasta só**, com o conteúdo das duas: limite conhecido, porque o caminho é a única identidade que vale entre navegadores.

A coluna `raiz` existe porque os títulos das raízes mudam com o idioma do Chrome. O casamento usa o token fixo, não o título. O primeiro segmento de `caminho` é só informativo.

Se não há correspondência exata e a URL é única no navegador e no CSV, a linha vale como mover o favorito existente. Se a URL é repetida, vale como criar. A prévia diz qual dos dois aconteceu.

## Quais endereços a importação aceita

A exportação leva todos os favoritos, mas a importação só aceita `http:`, `https:` e `file:` (arquivos locais, como PDFs). Links `file:` não passam por `normalizeUrl`, que continua só para a web (duplicados, sem uso, teste de links); a chave deles no CSV é a URL sem o `#fragmento` (`structureUrlKey`). Outros esquemas (`javascript:`, `chrome:`, `data:`) aparecem na prévia como linhas que não puderam ser lidas: um CSV de fora não deve criar bookmarklets nem atalhos para páginas internas do Chrome. Adicionado em 2026-11-04, depois de o teste manual mostrar PDFs locais recusados na ida e volta.

## Por que a importação só cria e move

Importar um CSV nunca remove nem renomeia nada: um CSV incompleto, ou de outro navegador, não pode apagar o que já existe. A importação cria pastas e favoritos que faltam, move favoritos para a pasta que o CSV indica e grava marcas. Pastas raiz do Chrome nunca são tocadas. Itens que já existem não são reordenados.

Sugestão e aprovação do CSV sobrescrevem os valores existentes só quando a célula não está vazia; célula vazia não apaga nada.

Marcas nas linhas das raízes do Chrome (Barra, Outros, Mobile) são ignoradas, e a prévia avisa ("Marca em pasta raiz do Chrome ignorada") quando a linha pedia alguma marca. A extensão nunca mexe nas raízes, e uma raiz marcada "não mexer" protegeria a árvore inteira de uma vez, o que dificilmente é o que o usuário quis numa célula de planilha.

## Por que a Lixeira fica fora do CSV

A exportação deixa de fora a pasta `Lixeira (Organizar Favoritos)` e tudo dentro dela, e a importação ignora qualquer linha que esteja dentro de uma pasta com esse nome em "Outros favoritos" ("Lixeira da extensão: não é importada"). A Lixeira é uma área de espera da Limpeza, não parte da estrutura: levar o seu conteúdo para outro navegador recriaria lixo lá, e uma linha que diga que um favorito está na Lixeira faria a importação mover para ela um favorito vivo, ou seja, apagá-lo pela porta dos fundos. Por isso a importação nunca cria nada na Lixeira nem move nada para ela.

## Como a marca de pasta protege os descendentes

O CSV grava `sim` só na linha da própria pasta, nunca nos descendentes. A **proteção efetiva** de um item é a marca própria ou a marca de qualquer pasta ancestral. Na tabela, um item protegido só por herança aparece com a caixa marcada e desabilitada, com a pasta de origem indicada; só a marca própria é alternável. Na importação, "já protegido" usa a proteção efetiva: um favorito protegido não é movido pela importação, e a prévia avisa.

## Proteção contra fórmulas (apóstrofo)

Planilhas interpretam como fórmula uma célula que começa com `=`, `+`, `-` ou `@`. Na exportação, as colunas `caminho`, `titulo`, `url` e `sugestao` recebem um `'` antes de um valor assim. Na importação o `'` é removido.

Para a ida e volta não perder um apóstrofo que já existia no valor original, a regra olha o primeiro caractere **depois da sequência de apóstrofos iniciais**: se for um dos quatro, a exportação acrescenta um `'` (então `'=1` vira `''=1`), e a importação remove exatamente um `'` nesse mesmo caso. Assim `guardFormula` e `unguardFormula` são inversas. Um apóstrofo inicial que não precede um desses quatro caracteres (por exemplo `'abc`) não é tocado em nenhum dos dois sentidos. As colunas `tipo`, `ordem`, `nao_mexer`, `aprovado` e `raiz` têm valores fixos e ficam fora da regra.

## Replanejar antes de aplicar

O plano da prévia pode ficar velho: o usuário pode mexer nos favoritos entre abrir a prévia e confirmar. Ao aplicar, a importação casa o CSV de novo com a árvore e as marcas daquele momento. Um item escolhido que sumiu, ou que mudou de natureza (um "criar" cuja pasta já existe passou a ser "mover", por exemplo), fica de fora e é contado como "mudou desde a prévia". Isso evita duplicar uma pasta ou mover algo com base em informação velha.

## Backup próprio na importação

A importação sempre faz um backup novo, sem reaproveitar o backup compartilhado de outro plano recente (`shareBackup: false`). Como ela pode criar centenas de itens, o ponto de restauração tem de ser o estado de imediato antes dela. Se o backup falhar, nada é aplicado. O Desfazer reverte as operações e restaura as marcas alteradas, guardadas no diário; as criações desfazem com `remove`, como no resto do projeto.

O Desfazer de uma importação volta as marcas ao estado de antes dela, mesmo que o usuário tenha mudado alguma delas à mão depois: o diário guarda o valor anterior de cada marca tocada e o regrava, sem comparar com o valor de agora.

## Verificação manual (pendente)

**Nada abaixo foi verificado ainda.** A verificação precisa de uma pessoa no Chrome real (perfil de teste, `npm run build`) e do Google Planilhas. Os testes automatizados cobrem a lógica; a interface e o Planilhas ainda não foram conferidos.

- [ ] Marcar favoritos e pastas; a caixa herdada fica travada; os filtros da tabela funcionam.
- [x] Exportar e abrir no Google Planilhas (Arquivo → Importar → Upload): acentos, emoji e colunas corretos? (2026-11-04: acentos corretos)
- [ ] Editar `nao_mexer` no Planilhas, baixar como CSV e importar de volta: a marca muda e nada mais.
- [ ] Importar o mesmo CSV em um perfil vazio: árvore igual. Importar de novo: "nada a importar".
- [ ] Desfazer a importação.
- [ ] Restaurar um backup com marcas.
- [ ] Google Planilhas pode converter títulos que parecem número/data e apaga apóstrofo inicial isolado em títulos de links novos — conferir.

BOM: **não é necessário.** Em 2026-11-04 o CSV exportado sem BOM abriu no Google Planilhas com os acentos corretos.

Resultado: a exportação continua sem BOM. A ida e volta no mesmo navegador deu "nada a importar", como esperado, mas expôs dois pontos (favoritos `file:///` rejeitados e a mensagem da prévia), anotados em [`../melhorias.md`](../melhorias.md). Os testes da marca (marcar, herança, editar `nao_mexer` no Planilhas) e da restauração com marcas ficam para depois do redesenho da marca "não mexer".
