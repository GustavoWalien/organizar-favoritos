import { describe, expect, it } from 'vitest'
import { isCheckableUrl, normalizeUrl } from '../../src/core/url'

describe('normalizeUrl', () => {
  it('padroniza esquema e host, tira fragmento e rastreio, ordena parâmetros e tira a barra final', () => {
    expect(normalizeUrl('HTTPS://Example.com/a/?utm_source=x&b=2&a=1#top')).toBe('https://example.com/a?a=1&b=2')
  })
  it('a raiz sem barra final', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com')
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })
  it('remove fbclid, gclid e qualquer utm_*, mas preserva os outros parâmetros', () => {
    expect(normalizeUrl('https://a.com/p?fbclid=1&gclid=2&utm_campaign=3&id=9')).toBe('https://a.com/p?id=9')
  })
  it('preserva portas diferentes da padrão', () => {
    expect(normalizeUrl('http://a.com:8080/x')).toBe('http://a.com:8080/x')
    expect(normalizeUrl('http://a.com:80/x')).toBe('http://a.com/x')
  })
  it('devolve null para URL inválida ou que não seja web', () => {
    for (const u of ['javascript:alert(1)', 'chrome://settings', 'file:///tmp/a.html', 'data:text/plain,hi', 'ftp://a.com/x', 'não é url', '']) {
      expect(normalizeUrl(u)).toBeNull()
    }
  })
})

describe('isCheckableUrl', () => {
  it('aceita sites públicos', () => {
    expect(isCheckableUrl('https://exemplo.com.br')).toBe(true)
    expect(isCheckableUrl('http://8.8.8.8/')).toBe(true)
  })
  it('recusa localhost, .local, hosts sem ponto e IPs privados', () => {
    for (const u of ['http://localhost:3000', 'http://meu.local/x', 'http://wiki/home', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.10/x', 'http://172.16.0.1/', 'http://172.31.255.1/', 'http://169.254.1.1/', 'http://[::1]/']) {
      expect(isCheckableUrl(u), u).toBe(false)
    }
  })
  it('o limite do bloco 172.16–31 é exato', () => {
    expect(isCheckableUrl('http://172.15.0.1/')).toBe(true)
    expect(isCheckableUrl('http://172.32.0.1/')).toBe(true)
  })
  it('recusa o que não é http(s)', () => {
    for (const u of ['javascript:void(0)', 'chrome://extensions', 'file:///a', 'ftp://a.com']) expect(isCheckableUrl(u), u).toBe(false)
  })
})
