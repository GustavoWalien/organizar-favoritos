import type { ItemMark } from './marks'

export interface BmLink {
  kind: 'link'
  id: string
  parentId: string
  index?: number
  title: string
  url: string
  dateAdded: number
  dateLastUsed?: number
}

export interface BmFolder {
  kind: 'folder'
  id: string
  parentId?: string
  index?: number
  title: string
  dateAdded?: number
  children: BmNode[]
}

export type BmNode = BmLink | BmFolder

/** Link com os títulos das pastas ancestrais (sem o nó raiz). */
export interface FlatLink extends BmLink {
  path: string[]
}

/** Acesso aos favoritos; implementado por `chromeBookmarksApi` e por falsos nos testes. */
export interface BookmarksApi {
  /** Devolve `[raiz]`. */
  getTree(): Promise<BmNode[]>
  /** O nó com `index`; pastas vêm com todos os `children`. */
  get(id: string): Promise<BmNode | undefined>
  createFolder(parentId: string, title: string): Promise<string>
  createLink(parentId: string, title: string, url: string): Promise<string>
  move(id: string, parentId: string, index?: number): Promise<void>
  /** Remove o nó; pastas saem inteiras, com o conteúdo. */
  remove(id: string): Promise<void>
}

export interface Snapshot {
  id: string
  createdAt: number
  reason: string
  /** `manual` nunca é apagado automaticamente. Ausente (backups antigos) conta como `auto`. */
  kind?: 'auto' | 'manual'
  tree: BmNode[]
  /** Marcas do usuário no momento do backup. Ausente em backups antigos. */
  flags?: ItemMark[]
}

export type Operation =
  /** `parentId` pode ser o `tempId` de uma pasta criada antes no mesmo plano. */
  | { op: 'create-folder'; tempId: string; parentId: string; title: string }
  /** `tempId` (opcional) permite que uma `PlanMark` do mesmo plano aponte para o link novo. */
  | { op: 'create-link'; tempId?: string; parentId: string; title: string; url: string }
  | { op: 'move'; id: string; toParentId: string; toIndex?: number }
  /** Só usado para esvaziar a Lixeira; não tem inverso. */
  | { op: 'remove'; id: string }

/** Mudança de marca dentro de um plano; `target` é um id real ou um `tempId` do próprio plano. */
export interface PlanMark {
  target: string
  patch: Partial<Omit<ItemMark, 'id'>>
}

export interface Plan {
  id: string
  label: string
  operations: Operation[]
  /** Gravadas depois das operações, já com os ids reais dos itens criados. */
  marks?: PlanMark[]
}

export interface JournalEntry {
  planId: string
  label: string
  appliedAt: number
  snapshotId: string
  /** Em ordem de aplicação; o desfazer percorre de trás para frente. */
  inverse: Operation[]
  /** Estado das marcas antes do plano (`null` = não havia marca); o desfazer o restaura. */
  marksBefore?: { id: string; prev: ItemMark | null }[]
}
