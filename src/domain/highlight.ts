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
  let i = 0
  let plain = ''
  const flush = () => {
    if (plain) parts.push({ text: plain })
    plain = ''
  }
  const push = (text: string, kind: CodeKind) => {
    flush()
    parts.push({ text, kind })
    i += text.length
  }
  while (i < line.length) {
    const rest = line.slice(i)
    const prev = line[i - 1] ?? ' '
    if (rest.startsWith('//') || rest.startsWith('/*')) {
      const close = rest.startsWith('/*') ? rest.indexOf('*/', 2) : -1
      push(close === -1 ? rest : rest.slice(0, close + 2), 'comment')
      continue
    }
    if (
      (hash && rest.startsWith('#')) ||
      (sqlDash && rest.startsWith('-- ')) ||
      (lang === '' && rest.startsWith('#') && line.slice(0, i).trim() === '')
    ) {
      push(rest, 'comment')
      continue
    }
    const quote = rest[0]
    if (quote === '"' || quote === "'" || quote === '`') {
      let j = 1
      while (j < rest.length && rest[j] !== quote) j += rest[j] === '\\' ? 2 : 1
      push(rest.slice(0, Math.min(j + 1, rest.length)), 'string')
      continue
    }
    const number = /^(?:0x[\da-f]+|\d[\d_]*(?:\.\d+)?)/i.exec(rest)
    if (number && !/[\w$]/.test(prev)) {
      push(number[0], 'number')
      continue
    }
    const word = /^[A-Za-z_$][\w$]*/.exec(rest)
    if (word && !/[\w$]/.test(prev)) {
      const w = word[0]
      if (KEYWORDS.has(w) || (lang === 'sql' && KEYWORDS.has(w.toLowerCase())))
        push(w, 'keyword')
      else if (/^[A-Z][a-z0-9]+[A-Za-z0-9]*$/.test(w)) push(w, 'type')
      else {
        plain += w
        i += w.length
      }
      continue
    }
    plain += line[i]
    i += 1
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
  const add = (t: string, kind?: InlineKind) => {
    if (t) parts.push({ text: t, kind: kind ?? base })
  }
  for (const m of text.matchAll(INLINE)) {
    add(text.slice(last, m.index))
    const whole = m[0]
    if (m[1]) {
      add(m[1], 'marker')
      add(whole.slice(m[1].length, whole.length - m[1].length), 'code')
      add(m[1], 'marker')
    } else if (m[3] !== undefined || m[4] !== undefined) {
      const mark = whole.slice(0, 2)
      add(mark, 'marker')
      add(whole.slice(2, -2), 'bold')
      add(mark, 'marker')
    } else if (m[5] !== undefined || m[6] !== undefined) {
      add(whole[0]!, 'marker')
      add(whole.slice(1, -1), 'italic')
      add(whole.at(-1)!, 'marker')
    } else if (m[7] !== undefined) {
      add('[', 'marker')
      add(m[7], 'link')
      add(`](${m[8]})`, 'marker')
    } else add(whole, 'link')
    last = m.index + whole.length
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
      if (
        open &&
        open[2]!.startsWith(fence.marker) &&
        line.trim() === open[2]
      ) {
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
