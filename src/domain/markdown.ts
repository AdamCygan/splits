/**
 * Notatki to Markdown (GFM). Stare notatki to zwykły tekst i tak zostają w bazie:
 * renderer zachowuje pojedyncze nowe linie, a konstrukcje, które łatwo złapać przypadkiem
 * (wcięcie 4 spacjami jako kod, podkreślenie `---` jako nagłówek), są wyłączone.
 *
 * Tu są czyste operacje edytora: zaznaczenie wchodzi, nowy tekst i zaznaczenie wychodzą.
 */

export interface TextState {
  value: string
  start: number
  end: number
}

/** Początek i koniec linii obejmujących zaznaczenie. */
function lineRange(value: string, start: number, end: number) {
  const from = value.lastIndexOf('\n', start - 1) + 1
  // Zaznaczenie kończące się tuż po nowej linii nie obejmuje kolejnej linii.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end
  const nl = value.indexOf('\n', last)
  return { from, to: nl === -1 ? value.length : nl }
}

/**
 * Otacza zaznaczenie znacznikami (`**`, `_`, `` ` ``); bez zaznaczenia wstawia `placeholder`
 * i go zaznacza. Gdy zaznaczenie już jest otoczone tymi znacznikami, zdejmuje je.
 */
export function toggleWrap(
  s: TextState,
  marker: string,
  placeholder: string,
): TextState {
  const { value, start, end } = s
  const m = marker.length
  const before = value.slice(start - m, start)
  const after = value.slice(end, end + m)
  if (before === marker && after === marker) {
    return {
      value:
        value.slice(0, start - m) +
        value.slice(start, end) +
        value.slice(end + m),
      start: start - m,
      end: end - m,
    }
  }
  const selected = value.slice(start, end)
  if (
    selected.length >= 2 * m &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(m, -m)
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      start,
      end: start + inner.length,
    }
  }
  const inner = selected || placeholder
  return {
    value: value.slice(0, start) + marker + inner + marker + value.slice(end),
    start: start + m,
    end: start + m + inner.length,
  }
}

const LIST_PREFIX = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] |#{1,6} )/

/**
 * Przełącza prefiks linii (`## `, `- `, `- [ ] `, `1. `) dla wszystkich zaznaczonych linii.
 * Gdy wszystkie już go mają, zdejmuje; inny prefiks listy/nagłówka zamienia na nowy.
 */
export function toggleLinePrefix(s: TextState, prefix: string): TextState {
  const { from, to } = lineRange(s.value, s.start, s.end)
  const lines = s.value.slice(from, to).split('\n')
  const numbered = prefix === '1. '
  const has = (line: string) => {
    const match = LIST_PREFIX.exec(line)
    if (!match) return false
    const marker = match[0].slice(match[1]!.length)
    return numbered ? /^\d+[.)] $/.test(marker) : marker === prefix
  }
  const filled = lines.filter((line) => line.trim() !== '')
  // Pusta linia (kursor na nowej linii) dostaje prefiks, nie jest „już sformatowana”.
  const allHave = filled.length > 0 && filled.every(has)
  let n = 0
  const next = lines.map((line) => {
    if (line.trim() === '' && lines.length > 1) return line
    const match = LIST_PREFIX.exec(line)
    const indent = match?.[1] ?? /^\s*/.exec(line)![0]
    const body = line.slice(match ? match[0].length : indent.length)
    if (allHave) return indent + body
    n += 1
    return indent + (numbered ? `${n}. ` : prefix) + body
  })
  const replaced = next.join('\n')
  const value = s.value.slice(0, from) + replaced + s.value.slice(to)
  if (s.start === s.end && lines.length === 1) {
    // Kursor zostaje w tym samym miejscu tekstu linii.
    const shift = replaced.length - (to - from)
    const pos = Math.max(from, s.start + shift)
    return { value, start: pos, end: pos }
  }
  return { value, start: from, end: from + replaced.length }
}

/** Blok kodu wokół zaznaczonych linii (albo pusty blok z kursorem w środku). */
export function insertCodeBlock(s: TextState, language = ''): TextState {
  const { value, start, end } = s
  if (start === end) {
    const atLineStart = start === 0 || value[start - 1] === '\n'
    const lead = atLineStart ? '' : '\n'
    const fence = `${lead}\`\`\`${language}\n`
    const tail =
      value[start] === '\n' || start === value.length ? '\n```' : '\n```\n'
    return {
      value: value.slice(0, start) + fence + tail + value.slice(start),
      start: start + fence.length,
      end: start + fence.length,
    }
  }
  const { from, to } = lineRange(value, start, end)
  const body = value.slice(from, to)
  const block = `\`\`\`${language}\n${body}\n\`\`\``
  return {
    value: value.slice(0, from) + block + value.slice(to),
    start: from + 4 + language.length,
    end: from + 4 + language.length + body.length,
  }
}

const CONTINUE = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) )/

/**
 * Enter w liście: nowa pozycja z tym samym znacznikiem (numer +1, pusty checkbox).
 * Enter w pustej pozycji kończy listę. `null` = zwykły Enter.
 */
export function continueList(s: TextState): TextState | null {
  const { value, start, end } = s
  if (start !== end) return null
  const from = value.lastIndexOf('\n', start - 1) + 1
  const line = value.slice(from, start)
  const match = CONTINUE.exec(line)
  if (!match) return null
  // Wewnątrz bloku kodu Enter zostaje zwykłym Enterem.
  const fences = value.slice(0, from).match(/^```/gm)?.length ?? 0
  if (fences % 2 === 1) return null
  const [whole, indent, marker, num, delim] = match
  if (
    line.length === whole.length &&
    value.slice(start).split('\n')[0]!.trim() === ''
  ) {
    // Pusta pozycja zagnieżdżona: wraca poziom wyżej (jak w edytorach tekstu).
    if (indent!.length > 0) return indentList(s, -1)
    // Pusta pozycja: koniec listy. Zostaje pusta linia, żeby dalszy tekst nie dokleił się
    // do ostatniej pozycji (w Markdown linia tuż pod listą jest jej częścią).
    const blank = from > 0 && value[from - 2] !== '\n' ? '\n' : ''
    return {
      value: value.slice(0, from) + blank + value.slice(start),
      start: from + blank.length,
      end: from + blank.length,
    }
  }
  const nextMarker =
    num !== undefined
      ? `${Number(num) + 1}${delim} `
      : marker!.replace(/\[[xX]\]/, '[ ]')
  const insert = `\n${indent}${nextMarker}`
  return {
    value: value.slice(0, start) + insert + value.slice(end),
    start: start + insert.length,
    end: start + insert.length,
  }
}

const LIST_ITEM = /^( *)([-*+]|\d+[.)]) /

/** Szerokość znacznika z odstępem: zagnieżdżona pozycja zaczyna się pod tekstem rodzica. */
const markerWidth = (marker: string) => marker.length + 1

/**
 * Tab / Shift+Tab w liście: pozycja schodzi poziom niżej (pod poprzednią pozycję) albo
 * wraca poziom wyżej. Wcięcie liczy się od znacznika rodzica (`- ` = 2, `1. ` = 3 spacje),
 * tak jak wymaga Markdown. `null` = w zaznaczeniu nie ma pozycji listy (Tab przenosi fokus).
 */
export function indentList(s: TextState, direction: 1 | -1): TextState | null {
  const { value } = s
  const { from, to } = lineRange(value, s.start, s.end)
  const before = value.slice(0, from).split('\n')
  before.pop() // pusty fragment po ostatnim \n (albo cały tekst przed pierwszą linią)
  const lines = value.slice(from, to).split('\n')
  if (!lines.some((l) => LIST_ITEM.test(l))) return null

  // Poprzednie pozycje listy (z już zmienionymi liniami zaznaczenia), najbliższe najpierw.
  const previous = (upTo: Array<string>) => {
    const items: Array<{ indent: number; marker: string }> = []
    for (let i = upTo.length - 1; i >= 0; i--) {
      const line = upTo[i]!
      const m = LIST_ITEM.exec(line)
      if (m) items.push({ indent: m[1]!.length, marker: m[2]! })
      else if (line.trim() !== '' && !/^\s/.test(line)) break
    }
    return items
  }

  const done: Array<string> = []
  let caretShift = 0
  for (const [i, line] of lines.entries()) {
    const m = LIST_ITEM.exec(line)
    if (!m) {
      done.push(line)
      continue
    }
    const indent = m[1]!.length
    const items = previous([...before, ...done])
    let next = indent
    if (direction === 1) {
      // Schodzi pod poprzednią pozycję z tego samego poziomu; pierwsza pozycja zostaje.
      const sibling = items.find((x) => x.indent <= indent)
      if (sibling && sibling.indent === indent)
        next = indent + markerWidth(sibling.marker)
    } else if (indent > 0) {
      next = items.find((x) => x.indent < indent)?.indent ?? 0
    }
    if (i === 0) caretShift = next - indent
    done.push(' '.repeat(next) + line.slice(indent))
  }
  const replaced = done.join('\n')
  const result = value.slice(0, from) + replaced + value.slice(to)
  if (s.start === s.end && lines.length === 1) {
    const pos = Math.max(from, s.start + caretShift)
    return { value: result, start: pos, end: pos }
  }
  return { value: result, start: from, end: from + replaced.length }
}

/**
 * Przełącza checkbox pozycji listy zaczynającej się na `offset` (pozycja z parsera Markdown).
 * Zwraca `null`, gdy w tym miejscu nie ma checkboxa.
 */
export function toggleTaskAt(text: string, offset: number): string | null {
  const match = /^[ \t>]*(?:[-*+]|\d+[.)])[ \t]+\[( |x|X)\]/.exec(
    text.slice(offset),
  )
  if (!match) return null
  const at = offset + match[0].length - 2
  const next = match[1] === ' ' ? 'x' : ' '
  return text.slice(0, at) + next + text.slice(at + 1)
}

/** Notatka jako zwykły tekst (krótkie podglądy, czytniki ekranu w skrótach). */
export function notePlainText(text: string): string {
  return text
    .replace(/^```[^\n]*\n?/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^(\s*)[-*+]\s+\[[ xX]\]\s+/gm, '$1')
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\w*])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(
      /!?\[([^\]]*)\]\(([^)]*)\)/g,
      (_, label: string, url: string) => label || url,
    )
    .trim()
}
