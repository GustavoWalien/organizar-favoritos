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

**Status da verificação manual:** pendente. Os testes automatizados, o `compile` e o `build` passam; falta carregar no Chrome e conferir que o ícone aparece, o popup abre e "Abrir painel" abre a página completa.
