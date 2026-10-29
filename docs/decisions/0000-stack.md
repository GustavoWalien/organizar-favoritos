# 0000 — Stack e fluxo de desenvolvimento

## Versões instaladas (29/10/2026)

| Pacote | Versão |
|---|---|
| wxt | 0.21.5 (publicada em 26/10/2026) |
| @wxt-dev/module-react | 1.2.2 |
| react / react-dom | 19.3.1 |
| typescript | 5.9.3 |
| vitest | 5.0.5 |

O WXT estava ativo na checagem (versão publicada 3 dias antes). Template gerado com `wxt init -t react`.

## Fluxo WSL → Chrome do Windows

O código vive no WSL e o Chrome roda no Windows, então o `wxt dev` não consegue abrir o navegador. A opção `webExt.disabled` está ligada em `wxt.config.ts`.

1. No WSL: `npm run build` (ou `npm run dev` para o modo com recarga).
2. No Chrome: `chrome://extensions` → ativar **Modo do desenvolvedor** → **Carregar sem compactação**.
3. Escolher a pasta `\\wsl.localhost\Ubuntu\home\<usuario>\organizar-favoritos\.output\chrome-mv3`.
4. Depois de cada `npm run build`, clicar em recarregar na extensão em `chrome://extensions`.
5. O manifesto tem uma `key` pública fixa, então o ID da extensão é sempre o mesmo, mesmo que a pasta do build mude de lugar. Os backups e o diário de desfazer ficam no IndexedDB atrelado a esse ID.

**Status da verificação manual:** pendente. Os testes automatizados, o `compile` e o `build` passam; falta carregar no Chrome e conferir que o ícone aparece, o popup abre e "Abrir painel" abre a página completa.

## Checklist de verificação manual (marcos 0 a 2)

Itens que dependem do Chrome real e ainda não foram conferidos:

- [ ] Carregar `.output/chrome-mv3`: ícone aparece, popup abre, "Abrir painel" abre a página completa.
- [ ] Aba **Visão geral**: contagens batem com `chrome://bookmarks`; preencher `0001-date-last-used.md`.
- [ ] **Backups**: "Fazer backup agora" cria um item; exportar HTML e importar em um perfil limpo do Chrome (a árvore bate); "Restaurar tudo" cria `Restaurado em ...` sem mexer em mais nada; restaurar um item pela busca.
- [ ] **Limpeza**: analisar sem uso (conferir 3 itens conhecidos); mover 5 itens para a Lixeira → backup criado e **Desfazer** devolve cada um ao lugar; testar links numa pasta pequena e conferir à mão 3 "quebrados"; apagar um favorito pelo Chrome e aplicar um plano que o inclui (falha parcial é relatada); esvaziar a Lixeira e restaurar um item pelo backup.
