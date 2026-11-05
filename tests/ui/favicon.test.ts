import { describe, expect, it } from 'vitest'
import { faviconUrl } from '../../src/ui/favicon'

const BASE = 'chrome-extension://abc/_favicon/'

describe('faviconUrl', () => {
  it('pede ao cache do Chrome o ícone da página, em 32 px (nítido em telas de alta densidade)', () => {
    expect(faviconUrl('https://github.com/a/b?x=1&y=2', BASE)).toBe(
      'chrome-extension://abc/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2Fa%2Fb%3Fx%3D1%26y%3D2&size=32',
    )
  })

  it('sem endereço, não pede nada', () => {
    expect(faviconUrl('', BASE)).toBeNull()
  })

  it('fora da extensão (testes, sem chrome.runtime), não pede nada', () => {
    expect(faviconUrl('https://github.com', null)).toBeNull()
  })
})
