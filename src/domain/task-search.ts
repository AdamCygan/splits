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
