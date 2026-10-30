/**
 * CSV genérico no estilo RFC 4180, escrito à mão (sem biblioteca): vírgula como separador,
 * aspas duplas, `\r\n` entre linhas. Sem dependência do Chrome.
 */

function needsQuotes(field: string): boolean {
  for (const ch of field) {
    if (ch === ',' || ch === '"' || ch === '\r' || ch === '\n') return true
  }
  return false
}

function quote(field: string): string {
  return `"${field.replaceAll('"', '""')}"`
}

/** Serializa linhas em CSV; só põe aspas quando o campo exige. Sem BOM. */
export function toCsv(rows: string[][]): string {
  return rows
    .map((row) => {
      // Uma linha de um único campo vazio viraria linha em branco (descartada ao ler): vai entre aspas.
      if (row.length === 1 && row[0] === '') return '""'
      return row.map((f) => (needsQuotes(f) ? quote(f) : f)).join(',')
    })
    .join('\r\n')
}

type State = 'start' | 'unquoted' | 'quoted' | 'quoteInQuoted'

/**
 * Lê CSV. Remove o BOM inicial, aceita `\r\n`, `\n` e `\r` como fim de linha, campos entre aspas
 * (com vírgula, `""` e quebras) e descarta linhas totalmente vazias (sem nenhum caractere).
 */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith('\uFEFF') ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let state: State = 'start'
  let lineHasChars = false

  const endField = () => {
    row.push(field)
    field = ''
    state = 'start'
  }
  const endLine = () => {
    if (lineHasChars) {
      endField()
      rows.push(row)
    }
    row = []
    field = ''
    state = 'start'
    lineHasChars = false
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i)
    switch (state) {
      case 'quoted':
        if (ch === '"') state = 'quoteInQuoted'
        else field += ch
        continue
      case 'quoteInQuoted':
        if (ch === '"') {
          field += '"'
          state = 'quoted'
          continue
        }
        state = 'unquoted' // aspas fecharam o campo; o que vier agora é tratado como texto normal
        break
      default:
        break
    }

    if (ch === ',') {
      lineHasChars = true
      endField()
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src.charAt(i + 1) === '\n') i++
      endLine()
    } else if (ch === '"' && state === 'start') {
      lineHasChars = true
      state = 'quoted'
    } else {
      lineHasChars = true
      field += ch
      state = 'unquoted'
    }
  }
  endLine()
  return rows
}
