import { describe, expect, it } from 'vitest'
import { stepText } from '../../src/ui/stepText'

describe('stepText', () => {
  it('textos e plural', () => {
    expect(stepText({ id: 'duplicados', count: 37, done: false }).title).toBe('Juntar 37 duplicados')
    expect(stepText({ id: 'duplicados', count: 1, done: false }).title).toBe('Juntar 1 duplicado')
    expect(stepText({ id: 'testar-links', count: 0, done: false })).toMatchObject({ title: 'Testar os links', action: 'Testar' })
    expect(stepText({ id: 'quebrados', count: 2, done: false }).title).toBe('Revisar 2 links quebrados')
    expect(stepText({ id: 'quebrados', count: 1, done: false }).title).toBe('Revisar 1 link quebrado')
    expect(stepText({ id: 'sem-uso', count: 214, done: false }).title).toBe('Revisar 214 favoritos sem uso')
    expect(stepText({ id: 'sem-uso', count: 1, done: false }).title).toBe('Revisar 1 favorito sem uso')
    expect(stepText({ id: 'sem-categoria', count: 154, done: false })).toMatchObject({ title: 'Dar pasta a 154 favoritos sem categoria', action: 'Sugerir com IA' })
    expect(stepText({ id: 'backup', count: 0, done: false })).toMatchObject({ title: 'Fazer um backup', action: 'Fazer backup' })
    expect(stepText({ id: 'backup', count: 0, done: true }).title).toBe('Backup em dia')
    expect(stepText({ id: 'duplicados', count: 0, done: true }).title).toBe('Nenhum duplicado')
  })
})
