import { describe, expect, it } from 'vitest'
import { backupFileName } from '../../src/ui/fileName'

describe('backupFileName', () => {
  it('usa a data e a hora locais e a extensão pedida', () => {
    const t = new Date(2026, 9, 29, 15, 7).getTime()
    expect(backupFileName(t, 'json')).toBe('favoritos-2026-10-29-1507.json')
    expect(backupFileName(t, 'html')).toBe('favoritos-2026-10-29-1507.html')
  })
})
