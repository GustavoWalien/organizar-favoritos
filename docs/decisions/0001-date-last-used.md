# 0001 — `dateLastUsed` nos favoritos

O Chrome expõe `dateLastUsed` em `chrome.bookmarks` desde a versão 114 (documentação oficial). O campo vale para favoritos, não para pastas.

## O que medir (pendente)

Abrir o painel → aba **Visão geral** com a coleção real e anotar:

- Total de favoritos / total com data de último uso (a aba mostra a porcentagem).
- O que o Chrome devolve para favoritos nunca abertos: campo ausente ou `0`?

Resultado: _a preencher_.

## Consequência já decidida

`dateLastUsed` ausente ou `0` conta como ausente: a limpeza cai para `dateAdded` e marca o motivo como `sem-registro` (Task 10).
