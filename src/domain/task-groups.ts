import type { TimeEntry } from '#/data/types'
import { taskGroupKey } from './report'

/**
 * Zadanie złożone z sesji: wpisy o tym samym kluczu (link albo typ + tytuł) to jedno
 * zadanie. Tu jest jedno źródło prawdy dla „ostatnia sesja”, „ile czasu w sumie”,
 * „czy zakończone” — używają go wyszukiwarki, lista „Do dokończenia”, Zadania i paleta.
 */
export type TaskAggregate = {
  key: string
  /** Najświeższa sesja: z niej startuje „Kontynuuj”, z niej bierzemy tytuł i link. */
  latest: TimeEntry
  sessions: Array<TimeEntry>
  workedMinutes: number
  lastDate: string
  finished: boolean
  running: boolean
}

/** Czy sesja `a` jest późniejsza od `b`: dzień, potem godzina startu, potem kolejność dodania. */
export const isLaterSession = (a: TimeEntry, b: TimeEntry) =>
  a.workDate !== b.workDate
    ? a.workDate > b.workDate
    : (a.startTime ?? '') !== (b.startTime ?? '')
      ? (a.startTime ?? '') > (b.startTime ?? '')
      : a.createdAt > b.createdAt

/** Sesje pogrupowane po zadaniu, w kolejności pierwszego wystąpienia. */
export function groupEntriesByTask(
  entries: ReadonlyArray<TimeEntry>,
): Map<string, Array<TimeEntry>> {
  const groups = new Map<string, Array<TimeEntry>>()
  for (const e of entries) {
    const key = taskGroupKey(e)
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  return groups
}

/** Zadania z sesji, od ostatnio ruszanego. */
export function aggregateTasks(
  entries: ReadonlyArray<TimeEntry>,
): Array<TaskAggregate> {
  return [...groupEntriesByTask(entries)]
    .map(([key, sessions]) => {
      const latest = sessions.reduce((a, b) => (isLaterSession(b, a) ? b : a))
      return {
        key,
        latest,
        sessions,
        workedMinutes: sessions.reduce((s, e) => s + e.durationMinutes, 0),
        lastDate: latest.workDate,
        finished: sessions.some((e) => e.finishedAt !== null),
        running: sessions.some((e) => e.running),
      }
    })
    .sort((a, b) => (isLaterSession(a.latest, b.latest) ? -1 : 1))
}
