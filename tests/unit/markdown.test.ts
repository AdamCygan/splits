import { describe, expect, it } from 'vitest'
import {
  continueList,
  indentList,
  insertCodeBlock,
  notePlainText,
  toggleLinePrefix,
  toggleTaskAt,
  toggleWrap,
} from '#/domain/markdown'
import type { TextState } from '#/domain/markdown'

/** `|` oznacza kursor, `«` i `»` zaznaczenie. */
function state(marked: string): TextState {
  const caret = marked.indexOf('|')
  if (caret !== -1) {
    const value = marked.replace('|', '')
    return { value, start: caret, end: caret }
  }
  const start = marked.indexOf('«')
  const end = marked.indexOf('»') - 1
  return { value: marked.replace('«', '').replace('»', ''), start, end }
}
function show(s: TextState | null): string | null {
  if (!s) return null
  if (s.start === s.end)
    return s.value.slice(0, s.start) + '|' + s.value.slice(s.start)
  return `${s.value.slice(0, s.start)}«${s.value.slice(s.start, s.end)}»${s.value.slice(s.end)}`
}

describe('note editor operations', () => {
  it('wraps and unwraps a selection', () => {
    expect(show(toggleWrap(state('Fix «retry» logic'), '**', 'bold'))).toBe(
      'Fix **«retry»** logic',
    )
    expect(show(toggleWrap(state('Fix **«retry»** logic'), '**', 'bold'))).toBe(
      'Fix «retry» logic',
    )
    expect(show(toggleWrap(state('Fix «**retry**» logic'), '**', 'bold'))).toBe(
      'Fix «retry» logic',
    )
  })

  it('inserts a selected placeholder without a selection', () => {
    expect(show(toggleWrap(state('Run |'), '`', 'code'))).toBe('Run `«code»`')
  })

  it('toggles list and heading prefixes on every selected line', () => {
    expect(show(toggleLinePrefix(state('«one\ntwo»'), '- [ ] '))).toBe(
      '«- [ ] one\n- [ ] two»',
    )
    expect(
      show(toggleLinePrefix(state('«- [ ] one\n- [ ] two»'), '- [ ] ')),
    ).toBe('«one\ntwo»')
    expect(show(toggleLinePrefix(state('«- one\n- two»'), '1. '))).toBe(
      '«1. one\n2. two»',
    )
    expect(show(toggleLinePrefix(state('Sum|mary'), '## '))).toBe('## Sum|mary')
    expect(show(toggleLinePrefix(state('Plan\n|'), '- [ ] '))).toBe(
      'Plan\n- [ ] |',
    )
    expect(show(toggleLinePrefix(state('## Sum|mary'), '## '))).toBe('Sum|mary')
  })

  it('wraps lines in a code block or opens an empty one', () => {
    expect(insertCodeBlock(state('«const a = 1»')).value).toBe(
      '```\nconst a = 1\n```',
    )
    expect(show(insertCodeBlock(state('Logs:|')))).toBe('Logs:\n```\n|\n```')
  })

  it('Enter continues a list and ends it on an empty item', () => {
    expect(show(continueList(state('- [x] done|')))).toBe('- [x] done\n- [ ] |')
    expect(show(continueList(state('1. one|')))).toBe('1. one\n2. |')
    expect(show(continueList(state('  - nested|')))).toBe('  - nested\n  - |')
    expect(show(continueList(state('- one\n- |')))).toBe('- one\n\n|')
    expect(continueList(state('plain|'))).toBeNull()
    expect(continueList(state('```\n- not a list|'))).toBeNull()
  })

  it('Tab nests a list item under the previous one, Shift+Tab brings it back', () => {
    expect(show(indentList(state('- one\n- tw|o'), 1))).toBe('- one\n  - tw|o')
    expect(show(indentList(state('1. one\n2. tw|o'), 1))).toBe(
      '1. one\n   2. tw|o',
    )
    expect(show(indentList(state('- [ ] one\n- [ ] tw|o'), 1))).toBe(
      '- [ ] one\n  - [ ] tw|o',
    )
    // Trzeci poziom pod drugim.
    expect(show(indentList(state('- a\n  - b\n  - |c'), 1))).toBe(
      '- a\n  - b\n    - |c',
    )
    // Pierwsza pozycja nie ma pod czym się schować.
    expect(show(indentList(state('- on|e'), 1))).toBe('- on|e')
    expect(show(indentList(state('- a\n  - |b'), -1))).toBe('- a\n- |b')
    expect(show(indentList(state('1. a\n   - |b'), -1))).toBe('1. a\n- |b')
    // Poza listą Tab działa normalnie (fokus idzie dalej).
    expect(indentList(state('plain |text'), 1)).toBeNull()
  })

  it('indents every selected list line', () => {
    expect(show(indentList(state('- a\n«- b\n- c»'), 1))).toBe(
      '- a\n«  - b\n  - c»',
    )
  })

  it('Enter on an empty nested item moves it one level up', () => {
    expect(show(continueList(state('- a\n  - |')))).toBe('- a\n- |')
  })

  it('ticks the checkbox of the list item at an offset', () => {
    const text = 'Todo:\n- [ ] tests\n- [x] review'
    expect(toggleTaskAt(text, text.indexOf('- [ ]'))).toBe(
      'Todo:\n- [x] tests\n- [x] review',
    )
    expect(toggleTaskAt(text, text.indexOf('- [x]'))).toBe(
      'Todo:\n- [ ] tests\n- [ ] review',
    )
    expect(toggleTaskAt(text, 0)).toBeNull()
  })

  it('turns a note into plain text for short previews', () => {
    expect(
      notePlainText(
        '## Done\n- [x] **tests** for `retry`\n- see [PR](https://x.y)\n```\ncode\n```',
      ),
    ).toBe('Done\ntests for retry\n• see PR\ncode')
    // Zwykły tekst zostaje bez zmian.
    expect(notePlainText('Fixed snake_case_var. Waiting for QA.')).toBe(
      'Fixed snake_case_var. Waiting for QA.',
    )
  })
})
