import type { TaskSearchResult, TimeEntry } from '#/data/types'
import { taskGroupKey } from './report'

export const TASK_SEARCH_LIMIT = 8

/** Wzorzec ILIKE z tekstu użytkownika: % i _ są zwykłymi znakami. */
export const likePattern = (q: string) =>
  `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/**
 * Wyniki wyszukiwania zadań: sesje zgrupowane jak w raportach (link albo typ + tytuł),
 * najświeższa sesja, łączny czas, czy zakończone i czy właśnie trwa. Najnowsze najpierw.
 */
export function groupSearchResults(
  entries: ReadonlyArray<TimeEntry>,
): Array<TaskSearchResult> {
  const groups = new Map<string, Array<TimeEntry>>()
  for (const e of entries) {
    const key = taskGroupKey(e)
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  return [...groups.values()]
    .map((list) => {
      const latest = list.reduce((a, b) =>
        b.workDate > a.workDate ||
        (b.workDate === a.workDate && b.createdAt > a.createdAt)
          ? b
          : a,
      )
      return {
        entry: latest,
        workedMinutes: list.reduce((s, e) => s + e.durationMinutes, 0),
        sessions: list.length,
        lastDate: latest.workDate,
        finished: list.some((e) => e.finishedAt !== null),
        running: list.some((e) => e.running),
      }
    })
    .sort(
      (a, b) =>
        b.lastDate.localeCompare(a.lastDate) ||
        b.entry.createdAt.localeCompare(a.entry.createdAt),
    )
    .slice(0, TASK_SEARCH_LIMIT)
}

/** Słowa zapytania (bez duplikatów, najwyżej 6), małymi literami. */
export function searchWords(q: string) {
  return [
    ...new Set(
      q
        .toLocaleLowerCase()
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0),
    ),
  ].slice(0, 6)
}

/** Notatka jako zwykły tekst: bez znaczników Markdown, w jednej linii. */
const plain = (note: string) =>
  note
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(?:[-*+]\s+\[[ xX]\]|[-*+]|\d+\.|#{1,6}|>)\s*/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Fragment notatki wokół pierwszego trafionego słowa, np. „…retry policy for 5xx…”. */
export function noteSnippet(note: string, words: ReadonlyArray<string>) {
  const text = plain(note)
  const lower = text.toLocaleLowerCase()
  const at = words
    .map((w) => lower.indexOf(w))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0]
  if (at === undefined) return null
  const start = Math.max(0, at - 40)
  const end = Math.min(text.length, at + 80)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export type RankedSearchResult = TaskSearchResult & {
  /** Fragment notatki, gdy zadanie znalazło się dzięki notatce. */
  snippet: string | null
}

/**
 * Wyszukiwarka palety (Ctrl+K): każde słowo musi wystąpić w tytule, linku albo notatce
 * którejś sesji zadania. Najwyżej: wszystkie słowa w tytule, potem w tytule lub linku,
 * potem w notatkach; w ramach grupy najświeższe najpierw.
 */
export function rankSearchResults(
  entries: ReadonlyArray<TimeEntry>,
  q: string,
  limit = 12,
): Array<RankedSearchResult> {
  const words = searchWords(q)
  if (words.length === 0) return []
  const groups = new Map<string, Array<TimeEntry>>()
  for (const e of entries) {
    const key = taskGroupKey(e)
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  const scored: Array<{ result: RankedSearchResult; score: number }> = []
  for (const list of groups.values()) {
    const latest = list.reduce((a, b) =>
      b.workDate > a.workDate ||
      (b.workDate === a.workDate && b.createdAt > a.createdAt)
        ? b
        : a,
    )
    const title = latest.title.toLocaleLowerCase()
    const link = (latest.link ?? '').toLocaleLowerCase()
    const notes = list
      .map((e) =>
        [e.note, e.overtimeNote, e.extensionNote].filter(Boolean).join('\n'),
      )
      .join('\n')
    const haystack = `${title}\n${link}\n${notes.toLocaleLowerCase()}`
    if (!words.every((w) => haystack.includes(w))) continue
    const inTitle = words.every((w) => title.includes(w))
    const inHead = words.every((w) => title.includes(w) || link.includes(w))
    const score = inTitle ? 3 : inHead ? 2 : 1
    // Fragment z najświeższej sesji, której notatka zawiera któreś słowo.
    const withNote = [...list]
      .reverse()
      .map((e) =>
        [e.note, e.overtimeNote, e.extensionNote].filter(Boolean).join('\n'),
      )
      .find((n) => words.some((w) => n.toLocaleLowerCase().includes(w)))
    scored.push({
      score,
      result: {
        entry: latest,
        workedMinutes: list.reduce((s, e) => s + e.durationMinutes, 0),
        sessions: list.length,
        lastDate: latest.workDate,
        finished: list.some((e) => e.finishedAt !== null),
        running: list.some((e) => e.running),
        snippet: !inHead && withNote ? noteSnippet(withNote, words) : null,
      },
    })
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.result.lastDate.localeCompare(a.result.lastDate) ||
        b.result.entry.createdAt.localeCompare(a.result.entry.createdAt),
    )
    .slice(0, limit)
    .map((x) => x.result)
}
