export interface Tokens {
  bg: string
  sidebar: string
  surface: string
  raised: string
  border: string
  text: string
  textSecondary: string
  textTertiary: string
  primary: string
  primaryText: string
  link: string
  warnBg: string
  warnText: string
  dangerBg: string
  dangerText: string
  okBg: string
  okText: string
}

export const darkTokens: Tokens = {
  bg: '#14171d',
  sidebar: '#181c23',
  surface: '#1d222b',
  raised: '#232b3d',
  border: '#2c333f',
  text: '#e8eaed',
  textSecondary: '#a0a8b5',
  textTertiary: '#8f98a6',
  primary: '#4a67d8',
  primaryText: '#ffffff',
  link: '#9fb4ff',
  warnBg: '#2a2113',
  warnText: '#f0b45a',
  dangerBg: '#2c1a1c',
  dangerText: '#f0968d',
  okBg: '#14291f',
  okText: '#7bd8a3',
}

export const lightTokens: Tokens = {
  bg: '#f6f7f9',
  sidebar: '#ffffff',
  surface: '#ffffff',
  raised: '#eef1f6',
  border: '#dde1e8',
  text: '#1f2328',
  textSecondary: '#4b5565',
  textTertiary: '#5f6b7a',
  primary: '#3f5fd0',
  primaryText: '#ffffff',
  link: '#2848b8',
  warnBg: '#fff3e0',
  warnText: '#8a5a00',
  dangerBg: '#fdecea',
  dangerText: '#a52a1d',
  okBg: '#e8f5e9',
  okText: '#1e6b2e',
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
}

/** Razão de contraste WCAG entre duas cores "#rrggbb". */
export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
