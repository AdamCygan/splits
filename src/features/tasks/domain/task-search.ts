import type {
  TaskSearchResult,
  TimeEntry,
} from '#/features/time-entries/data/dto'
import { aggregateTasks, isLaterSession } from './task-groups'
import type { TaskAggregate } from './task-groups'

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
  return aggregateTasks(entries).slice(0, TASK_SEARCH_LIMIT).map(toSearchResult)
}

const toSearchResult = (task: TaskAggregate): TaskSearchResult => ({
  entry: task.latest,
  workedMinutes: task.workedMinutes,
  sessions: task.sessions.length,
  lastDate: task.lastDate,
  finished: task.finished,
  running: task.running,
})

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
  const notesOf = (e: TimeEntry) =>
    [e.note, e.overtimeNote, e.extensionNote].filter(Boolean).join('\n')
  const scored: Array<{ result: RankedSearchResult; score: number }> = []
  // aggregateTasks zwraca zadania od ostatnio ruszanego; sort niżej jest stabilny,
  // więc w obrębie tej samej punktacji ta kolejność zostaje.
  for (const task of aggregateTasks(entries)) {
    const title = task.latest.title.toLocaleLowerCase()
    const link = (task.latest.link ?? '').toLocaleLowerCase()
    const notes = task.sessions.map(notesOf).join('\n').toLocaleLowerCase()
    const haystack = `${title}\n${link}\n${notes}`
    if (!words.every((w) => haystack.includes(w))) continue
    const inTitle = words.every((w) => title.includes(w))
    const inHead = words.every((w) => title.includes(w) || link.includes(w))
    // Fragment z najświeższej sesji, której notatka zawiera któreś słowo.
    const withNote = [...task.sessions]
      .sort((a, b) => (isLaterSession(a, b) ? -1 : 1))
      .map(notesOf)
      .find((n) => words.some((w) => n.toLocaleLowerCase().includes(w)))
    scored.push({
      score: inTitle ? 3 : inHead ? 2 : 1,
      result: {
        ...toSearchResult(task),
        snippet: !inHead && withNote ? noteSnippet(withNote, words) : null,
      },
    })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.result)
}
