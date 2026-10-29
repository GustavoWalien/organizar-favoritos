import { describe, expect, it } from 'vitest'
import { BACKUP_WINDOW_MS, canShareBackup } from '../../src/core/backupPolicy'
import { createSnapshot } from '../../src/core/snapshot'

const NOW = 1_800_000_000_000
const auto = (ago: number) => createSnapshot([], 'x', NOW - ago, 'auto')

describe('canShareBackup', () => {
  it('um backup automático de 9 minutos atrás pode ser compartilhado', () => {
    expect(canShareBackup(auto(9 * 60_000), NOW)).toBe(true)
  })
  it('com exatamente 10 minutos a janela já fechou', () => {
    expect(canShareBackup(auto(BACKUP_WINDOW_MS), NOW)).toBe(false)
  })
  it('sem backup anterior, não compartilha', () => {
    expect(canShareBackup(undefined, NOW)).toBe(false)
  })
  it('backup manual nunca é compartilhado', () => {
    expect(canShareBackup(createSnapshot([], 'x', NOW - 1000, 'manual'), NOW)).toBe(false)
  })
  it('um backup com data no futuro (relógio mudou) não é compartilhado', () => {
    expect(canShareBackup(auto(-5000), NOW)).toBe(false)
  })
  it('snapshot antigo sem kind conta como automático', () => {
    const old = { ...auto(1000), kind: undefined }
    expect(canShareBackup(old, NOW)).toBe(true)
  })
})
