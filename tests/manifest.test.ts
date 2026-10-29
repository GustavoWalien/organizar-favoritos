import { describe, expect, it } from 'vitest'
import config from '../wxt.config'

describe('manifesto', () => {
  it('tem uma chave fixa: o ID da extensão (e os backups no IndexedDB) não muda se a pasta mudar de lugar', () => {
    const manifest = (config as { manifest: { key?: string } }).manifest
    expect(manifest.key).toMatch(/^[A-Za-z0-9+/]{300,}={0,2}$/)
  })
})
