/**
 * Lekkie podświetlanie dla notatek: składnia kodu (słowa kluczowe, napisy, komentarze,
 * liczby) i Markdown w polu edycji. Każdy fragment zachowuje dokładnie swoje znaki, więc
 * połączony tekst jest identyczny z wejściem (warstwa pod polem tekstowym musi się pokrywać).
 */

export type CodeKind = 'keyword' | 'string' | 'comment' | 'number' | 'type'
export interface Part {
  text: string
  kind?: CodeKind | InlineKind
}

const KEYWORDS = new Set(
  (
    'abstract as async await break case catch class const continue def default defer delete do ' +
    'elif else enum except export extends false final finally fn for from func function go if impl ' +
    'implements import in instanceof interface is lambda let match mod mut new nil none not null of ' +
    'or package pass private protected pub public raise readonly return self select static struct ' +
    'super switch this throw throws trait true try type typeof undefined unless use val var void ' +
    'when where while with yield and ' +
    // SQL (wielkie litery też łapiemy, porównanie bez wielkości liter dla SQL-a niżej)
    'insert update into values from where join left right inner outer group order by having limit ' +
    'create table alter drop index primary key references set begin commit rollback'
  ).split(' '),
)

const HASH_COMMENTS = new Set([
  'py',
  'python',
  'sh',
  'bash',
  'shell',
  'zsh',
  'yaml',
  'yml',
  'rb',
  'ruby',
  'toml',
  'ini',
  'dockerfile',
  'makefile',
  'r',
  'perl',
  'conf',
  'env',
])

/** Tokeny jednej linii kodu (komentarze blokowe nie przechodzą między liniami). */
export function highlightCodeLine(line: string, language = ''): Array<Part> {
  const lang = language.toLowerCase()
  const hash = HASH_COMMENTS.has(lang)
  const sqlDash = lang === 'sql' || lang === ''
  const parts: Array<Part> = []
  let index = 0
  let plain = ''
  const flush = () => {
    if (plain) parts.push({ text: plain })
    plain = ''
  }
  const push = (text: string, kind: CodeKind) => {
    flush()
    parts.push({ text, kind })
    index += text.length
  }
  while (index < line.length) {
    const rest = line.slice(index)
    const previous = line[index - 1] ?? ' '
    const isComment = rest.startsWith('//') || rest.startsWith('/*')
    if (isComment) {
      const close = rest.startsWith('/*') ? rest.indexOf('*/', 2) : -1
      push(close === -1 ? rest : rest.slice(0, close + 2), 'comment')
      continue
    }
    const isLineComment =
      (hash && rest.startsWith('#')) ||
      (sqlDash && rest.startsWith('-- ')) ||
      (lang === '' &&
        rest.startsWith('#') &&
        line.slice(0, index).trim() === '')
    if (isLineComment) {
      push(rest, 'comment')
      continue
    }
    const quote = rest[0]
    const isQuote = quote === '"' || quote === "'" || quote === '`'
    if (isQuote) {
      let position = 1
      while (position < rest.length && rest[position] !== quote)
        position += rest[position] === '\\' ? 2 : 1
      push(rest.slice(0, Math.min(position + 1, rest.length)), 'string')
      continue
    }
    const number = /^(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?)/i.exec(rest)
    const isNumber = number && !/[\w$]/.test(previous)
    if (isNumber) {
      push(number[0], 'number')
      continue
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)
    const isWord = word && !/[\w$]/.test(previous)
    if (isWord) {
      const firstCharacter = word[0]
      const isKeyword =
        KEYWORDS.has(firstCharacter) ||
        (lang === 'sql' && KEYWORDS.has(firstCharacter.toLowerCase()))
      const isTypeName = /^[A-Z][a-z0-9]+[A-Za-z0-9]*$/.test(firstCharacter)
      if (isKeyword) push(firstCharacter, 'keyword')
      else if (isTypeName) push(firstCharacter, 'type')
      else {
        plain += firstCharacter
        index += firstCharacter.length
      }
      continue
    }
    plain += line[index]
    index += 1
  }
  flush()
  return parts
}

export type InlineKind =
  | 'marker'
  | 'bold'
  | 'italic'
  | 'code'
  | 'link'
  | 'heading'
  | 'done'
  | 'checkbox'
  | 'quote'

export interface MarkdownLine {
  /** text: zwykła linia; fence: ``` otwierające/zamykające; code: linia w bloku kodu. */
  kind: 'text' | 'fence' | 'code'
  parts: Array<Part>
}

const INLINE =
  /(`+)([^`]|[^`][\s\S]*?[^`])\1|\*\*(?=\S)([\s\S]*?\S)\*\*|__(?=\S)([\s\S]*?\S)__|(?<![\w*])\*(?=\S)([^*]*?\S)\*(?![\w*])|(?<![\w_])_(?=\S)([^_]*?\S)_(?![\w_])|\[([^\]\n]*)\]\(([^)\n]*)\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g

/** Fragmenty jednej linii tekstu: kod, pogrubienie, kursywa, linki; znaczniki zostają. */
function inline(text: string, base?: InlineKind): Array<Part> {
  const parts: Array<Part> = []
  let last = 0
  const add = (fragment: string, kind?: InlineKind) => {
    if (fragment) parts.push({ text: fragment, kind: kind ?? base })
  }
  for (const match of text.matchAll(INLINE)) {
    add(text.slice(last, match.index))
    const [whole, backticks] = match
    const isBold = match[3] !== undefined || match[4] !== undefined
    const isItalic = match[5] !== undefined || match[6] !== undefined
    const linkLabel = match[7]
    const linkTarget = match[8]
    const isLink = linkLabel !== undefined
    if (backticks) {
      add(backticks, 'marker')
      add(
        whole.slice(backticks.length, whole.length - backticks.length),
        'code',
      )
      add(backticks, 'marker')
    } else if (isBold) {
      const mark = whole.slice(0, 2)
      add(mark, 'marker')
      add(whole.slice(2, -2), 'bold')
      add(mark, 'marker')
    } else if (isItalic) {
      add(whole[0]!, 'marker')
      add(whole.slice(1, -1), 'italic')
      add(whole.at(-1)!, 'marker')
    } else if (isLink) {
      add('[', 'marker')
      add(linkLabel, 'link')
      add(`](${linkTarget})`, 'marker')
    } else add(whole, 'link')
    last = match.index + whole.length
  }
  add(text.slice(last))
  return parts
}

/**
 * Markdown notatki linia po linii do podświetlenia w polu edycji: bloki kodu ze składnią,
 * nagłówki, znaczniki list i checkboxy, odhaczone pozycje przekreślone, cytaty.
 */
export function markdownLines(text: string): Array<MarkdownLine> {
  const out: Array<MarkdownLine> = []
  let fence: { marker: string; language: string } | null = null
  for (const line of text.split('\n')) {
    const open = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(line)
    if (fence) {
      const closesFence =
        open && open[2]!.startsWith(fence.marker) && line.trim() === open[2]
      if (closesFence) {
        out.push({ kind: 'fence', parts: [{ text: line, kind: 'marker' }] })
        fence = null
      } else
        out.push({
          kind: 'code',
          parts: highlightCodeLine(line, fence.language),
        })
      continue
    }
    if (open) {
      fence = { marker: open[2]!, language: open[3] ?? '' }
      out.push({ kind: 'fence', parts: [{ text: line, kind: 'marker' }] })
      continue
    }
    const heading = /^(\s{0,3}#{1,6}\s+)(.*)$/.exec(line)
    if (heading) {
      out.push({
        kind: 'text',
        parts: [
          { text: heading[1]!, kind: 'marker' },
          ...inline(heading[2]!, 'heading'),
        ],
      })
      continue
    }
    const item = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s)?(.*)$/.exec(line)
    if (item) {
      const [, indent, marker, gap, box, rest] = item
      const done = box !== undefined && /x/i.test(box)
      out.push({
        kind: 'text',
        parts: [
          ...(indent ? [{ text: indent }] : []),
          { text: marker! + gap!, kind: 'marker' as const },
          ...(box ? [{ text: box, kind: 'checkbox' as const }] : []),
          ...inline(rest!, done ? 'done' : undefined),
        ],
      })
      continue
    }
    const quote = /^(\s*>\s?)(.*)$/.exec(line)
    if (quote) {
      out.push({
        kind: 'text',
        parts: [
          { text: quote[1]!, kind: 'marker' },
          ...inline(quote[2]!, 'quote'),
        ],
      })
      continue
    }
    out.push({ kind: 'text', parts: inline(line) })
  }
  return out
}
