import { describe, expect, it } from 'vitest'
import { buildCleanupPlan, buildPurgePlan, findEmptyFolders, findTrash, TRASH_TITLE } from '../../src/core/cleanup'
import type { BmFolder, BmNode } from '../../src/core/types'
import { sampleTree } from '../fixtures/sampleTree'

const folder = (id: string, parentId: string, title: string, children: BmNode[] = []): BmFolder => ({ kind: 'folder', id, parentId, title, children })

/** sampleTree + pastas vazias na Barra ('6' vazia; '7' com a subpasta vazia '8') + 'Sub' vazia dentro de Dev. */
function treeWithEmpties(): BmNode[] {
  const t = structuredClone(sampleTree)
  const barra = (t[0] as BmFolder).children.find((c) => c.id === '1') as BmFolder
  barra.children.push(folder('6', '1', 'Vazia'), folder('7', '1', 'Pai', [folder('8', '7', 'Filha')]))
  ;(barra.children.find((c) => c.id === '5') as BmFolder).children.push(folder('9', '5', 'Sub'))
  return t
}

function withTrash(links: string[] = []): BmNode[] {
  const t = structuredClone(sampleTree)
  const outros = (t[0] as BmFolder).children.find((c) => c.id === '2') as BmFolder
  outros.children.push(folder('50', '2', TRASH_TITLE, links.map((id) => ({ kind: 'link' as const, id, parentId: '50', title: id, url: `https://x${id}.com/`, dateAdded: 1 }))))
  return t
}

describe('buildCleanupPlan', () => {
  it('cria a Lixeira em Outros favoritos quando não existe e move os links para ela', () => {
    const p = buildCleanupPlan(sampleTree, ['10', '11'], 'Limpeza')
    expect(p.operations[0]).toMatchObject({ op: 'create-folder', title: TRASH_TITLE, parentId: '2' })
    const temp = (p.operations[0] as { tempId: string }).tempId
    expect(p.operations.slice(1)).toEqual([
      { op: 'move', id: '10', toParentId: temp },
      { op: 'move', id: '11', toParentId: temp },
    ])
    expect(p.label).toBe('Limpeza')
  })

  it('reutiliza a Lixeira existente em vez de criar outra', () => {
    const p = buildCleanupPlan(withTrash(), ['10'], 'Limpeza')
    expect(p.operations).toEqual([{ op: 'move', id: '10', toParentId: '50' }])
  })

  it('ignora pastas raiz, pastas com conteúdo, ids inexistentes, repetidos e links que já estão na Lixeira', () => {
    const p = buildCleanupPlan(withTrash(['51']), ['1', '5', '999', '10', '10', '51'], 'Limpeza')
    expect(p.operations).toEqual([{ op: 'move', id: '10', toParentId: '50' }])
  })

  it('aceita pastas vazias', () => {
    const p = buildCleanupPlan(treeWithEmpties(), ['6', '7'], 'Pastas vazias')
    expect(p.operations.filter((o) => o.op === 'move').map((o) => (o as { id: string }).id)).toEqual(['6', '7'])
  })

  it('sem nenhum id válido, o plano fica vazio e a Lixeira não é criada', () => {
    expect(buildCleanupPlan(sampleTree, ['999', '1'], 'Limpeza').operations).toEqual([])
  })

  it('cada plano tem um id próprio', () => {
    expect(buildCleanupPlan(sampleTree, ['10'], 'a').id).not.toBe(buildCleanupPlan(sampleTree, ['10'], 'a').id)
  })
})

describe('buildPurgePlan e findTrash', () => {
  it('esvaziar remove a Lixeira inteira', () => {
    expect(buildPurgePlan(withTrash(['51'])).operations).toEqual([{ op: 'remove', id: '50' }])
  })
  it('sem Lixeira não há o que esvaziar', () => {
    expect(buildPurgePlan(sampleTree).operations).toEqual([])
    expect(findTrash(sampleTree)).toBeUndefined()
  })
  it('findTrash só considera a pasta dentro de Outros favoritos', () => {
    expect(findTrash(withTrash())?.id).toBe('50')
  })
})

describe('findEmptyFolders', () => {
  it('considera vazia a pasta que só tem subpastas vazias e devolve só a de cima', () => {
    expect(findEmptyFolders(treeWithEmpties()).map((f) => f.id)).toEqual(['9', '6', '7'])
  })
  it('não lista pasta que tem links nem as pastas raiz (a de Móveis é vazia mas protegida)', () => {
    const ids = findEmptyFolders(treeWithEmpties()).map((f) => f.id)
    expect(ids).not.toContain('5')
    expect(ids).not.toContain('3')
  })
  it('ignora a Lixeira, mesmo vazia', () => {
    expect(findEmptyFolders(withTrash()).map((f) => f.id)).toEqual([])
  })
})
