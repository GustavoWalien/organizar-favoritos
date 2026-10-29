import type { BmNode } from '../../src/core/types'

/** Raiz '0' → Barra '1' (pasta Dev '5' com links '10' e '11'), Outros '2' (link '20'), Móveis '3' (vazia). */
export const sampleTree: BmNode[] = [
  {
    kind: 'folder', id: '0', title: '', children: [
      {
        kind: 'folder', id: '1', parentId: '0', title: 'Barra de favoritos', children: [
          {
            kind: 'folder', id: '5', parentId: '1', title: 'Dev', children: [
              { kind: 'link', id: '10', parentId: '5', title: 'MDN', url: 'https://developer.mozilla.org/', dateAdded: 1_600_000_000_000, dateLastUsed: 1_700_000_000_000 },
              { kind: 'link', id: '11', parentId: '5', title: 'GitHub', url: 'https://github.com/', dateAdded: 1_600_000_100_000 },
            ],
          },
        ],
      },
      {
        kind: 'folder', id: '2', parentId: '0', title: 'Outros favoritos', children: [
          { kind: 'link', id: '20', parentId: '2', title: 'Exemplo', url: 'https://example.com/', dateAdded: 1_610_000_000_000 },
        ],
      },
      { kind: 'folder', id: '3', parentId: '0', title: 'Favoritos para dispositivos móveis', children: [] },
    ],
  },
]
