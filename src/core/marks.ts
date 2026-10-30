import type { BmNode } from './types'

/** Marcas do usuário sobre um favorito ou pasta, guardadas fora do Chrome (IndexedDB). */
export interface ItemMark {
  id: string
  naoMexer?: boolean
  sugestao?: string
  aprovado?: 'sim' | 'nao'
}

export type MarksMap = Map<string, ItemMark>

export interface EffectiveProtection {
  protected: boolean
  /** A própria marca "não mexer" está no item. */
  own: boolean
  /** Pasta ancestral mais próxima com a marca, quando a proteção vem dela. */
  byFolderId?: string
}

/** Caminho de ancestrais (da raiz até o próprio nó) ou `undefined` se o id não existe. */
function pathTo(tree: BmNode[], id: string): BmNode[] | undefined {
  for (const n of tree) {
    if (n.id === id) return [n]
    if (n.kind === 'folder') {
      const sub = pathTo(n.children, id)
      if (sub) return [n, ...sub]
    }
  }
  return undefined
}

/** Proteção efetiva: marca própria ou marca em qualquer pasta ancestral. */
export function isProtectedEffective(tree: BmNode[], marks: MarksMap, id: string): EffectiveProtection {
  if (marks.get(id)?.naoMexer) return { protected: true, own: true }
  const path = pathTo(tree, id)
  if (path) {
    for (let i = path.length - 2; i >= 0; i--) {
      const ancestorId = path[i]?.id
      if (ancestorId !== undefined && marks.get(ancestorId)?.naoMexer) {
        return { protected: true, own: false, byFolderId: ancestorId }
      }
    }
  }
  return { protected: false, own: false }
}

/**
 * Aplica só os campos definidos e não vazios de `patch`; `naoMexer: false` remove esse campo.
 * Devolve `undefined` quando a marca resultante fica sem nenhum campo.
 */
export function patchMark(
  prev: ItemMark | undefined,
  id: string,
  patch: Partial<Omit<ItemMark, 'id'>>,
): ItemMark | undefined {
  const next: ItemMark = { ...prev, id }
  if (patch.naoMexer === true) next.naoMexer = true
  else if (patch.naoMexer === false) delete next.naoMexer
  if (patch.sugestao) next.sugestao = patch.sugestao
  if (patch.aprovado) next.aprovado = patch.aprovado
  const { id: _id, ...fields } = next
  return Object.values(fields).some((v) => v !== undefined) ? next : undefined
}

/** Raiz do Chrome a que a pasta pertence: ids 1/2/3, senão a posição entre as filhas da raiz. */
export function rootToken(tree: BmNode[], rootId: string): 'barra' | 'outros' | 'mobile' | undefined {
  const tokens = ['barra', 'outros', 'mobile'] as const
  const byId: Record<string, (typeof tokens)[number]> = { '1': 'barra', '2': 'outros', '3': 'mobile' }
  const top = tree[0]
  const children = top && top.kind === 'folder' ? top.children : []
  if (!children.some((c) => c.id === rootId)) return undefined
  return byId[rootId] ?? tokens[children.findIndex((c) => c.id === rootId)]
}
