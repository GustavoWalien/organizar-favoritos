/** Minúsculas, sem acentos e sem espaços nas pontas, para buscar sem se preocupar com acento. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
