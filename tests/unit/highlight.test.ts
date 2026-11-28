import { describe, expect, it } from 'vitest'
import {
  highlightCodeLine,
  markdownLines,
} from '../../src/shared/domain/highlight'

const joined = (lines: ReturnType<typeof markdownLines>) =>
  lines
    .map((markdownLine) => markdownLine.parts.map((part) => part.text).join(''))
    .join('\n')

describe('code highlighting', () => {
  it('Should mark keywords, strings, numbers, comments and types', () => {
    const parts = highlightCodeLine(
      "const retries = 3 // max\nawait send('x')".split('\n')[0]!,
      'ts',
    )
    expect(parts).toEqual([
      { text: 'const', kind: 'keyword' },
      { text: ' retries = ' },
      { text: '3', kind: 'number' },
      { text: ' ' },
      { text: '// max', kind: 'comment' },
    ])
    expect(highlightCodeLine('new Retry("a\\"b")', 'ts')).toEqual([
      { text: 'new', kind: 'keyword' },
      { text: ' ' },
      { text: 'Retry', kind: 'type' },
      { text: '(' },
      { text: '"a\\"b"', kind: 'string' },
      { text: ')' },
    ])
  })

  it('Should know hash comments and SQL keywords', () => {
    expect(highlightCodeLine('x = 1  # note', 'py').at(-1)).toEqual({
      text: '# note',
      kind: 'comment',
    })
    expect(highlightCodeLine('SELECT id FROM t', 'sql')[0]).toEqual({
      text: 'SELECT',
      kind: 'keyword',
    })
    // Liczba w nazwie to nie liczba.
    expect(highlightCodeLine('v2', 'ts')).toEqual([{ text: 'v2' }])
  })
})

describe('markdown in the editor', () => {
  const text = [
    '## Plan',
    '- [x] **tests** for `retry`',
    '  - [ ] edge _cases_',
    '```ts',
    'const a = 1',
    '```',
    'See https://timeblame.com',
    '',
  ].join('\n')
  const lines = markdownLines(text)

  it('Should keep every character, so the layer lines up with the text field', () => {
    expect(joined(lines)).toBe(text)
    expect(lines).toHaveLength(8)
  })

  it('Should style headings, list markers, checked items, code blocks and links', () => {
    expect(lines[0]!.parts).toEqual([
      { text: '## ', kind: 'marker' },
      { text: 'Plan', kind: 'heading' },
    ])
    expect(lines[1]!.parts.map((part) => part.kind)).toEqual([
      'marker',
      'checkbox',
      'marker',
      'bold',
      'marker',
      'done',
      'marker',
      'code',
      'marker',
    ])
    expect(lines.slice(3, 6).map((markdownLine) => markdownLine.kind)).toEqual([
      'fence',
      'code',
      'fence',
    ])
    expect(lines[4]!.parts[0]).toEqual({ text: 'const', kind: 'keyword' })
    expect(lines[6]!.parts.at(-1)).toEqual({
      text: 'https://timeblame.com',
      kind: 'link',
    })
  })

  it('Should treat an unclosed code block as code until the end', () => {
    const open = markdownLines('```\nlet x\n- not a list')
    expect(open.map((markdownLine) => markdownLine.kind)).toEqual([
      'fence',
      'code',
      'code',
    ])
  })

  it('Should leave snake_case and plain text alone', () => {
    expect(markdownLines('Fix snake_case_var now')[0]!.parts).toEqual([
      { text: 'Fix snake_case_var now' },
    ])
  })
})
