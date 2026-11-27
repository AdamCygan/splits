import { maxOf } from './numbers'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { taskGroupKey } from './report'

/**
 * Zadanie złożone z sesji: wpisy o tym samym kluczu (link albo typ + tytuł) to jedno
 * zadanie. Tu jest jedno źródło prawdy dla „ostatnia sesja”, „ile czasu w sumie”,
 * „czy zakończone” — używają go wyszukiwarki, lista „Do dokończenia”, Zadania i paleta.
 */
export interface TaskAggregate {
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

/** Zadanie na liście dnia: sesje chronologicznie i fakty pokazywane na karcie. */
export interface DayTaskGroup {
  key: string
  /** Sesje od najwcześniejszej (wpisy bez godzin na końcu). */
  sessions: Array<TimeEntry>
  /** Ostatnio dodana sesja: z niej tytuł, link i „Kontynuuj”. */
  latest: TimeEntry
  running: TimeEntry | undefined
  /** Wstrzymane, gdy nic nie trwa, a któraś sesja ma pauzę. */
  paused: boolean
  /** Czas zakończonych sesji (działająca dolicza się w widoku co sekundę). */
  doneMinutes: number
  /** SP zadania: największa wartość z sesji (kilka sesji to wciąż jedno zadanie). */
  storyPoints: number | null
  /** Estymata zadania: największa podana w sesjach. */
  estimateMinutes: number | null
}

/**
 * Wpisy dnia pogrupowane w zadania (ten sam link albo typ i tytuł). Sesje w zadaniu idą
 * chronologicznie, a zadania od ostatnio ruszanego (działające na górze).
 */
export function dayTaskGroups(
  entries: ReadonlyArray<TimeEntry>,
): Array<DayTaskGroup> {
  const order = (e: TimeEntry) => `${e.startTime ?? '99:99'}|${e.createdAt}`
  const lastAdded = (list: ReadonlyArray<TimeEntry>) =>
    list.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), '')
  return [...groupEntriesByTask(entries)]
    .map(([key, list]) => {
      const sessions = [...list].sort((a, b) =>
        order(a).localeCompare(order(b)),
      )
      const running = sessions.find((e) => e.running)
      return {
        key,
        sessions,
        latest: sessions.at(-1)!,
        running,
        paused: !running && sessions.some((e) => e.paused),
        doneMinutes: sessions.reduce((s, e) => s + e.durationMinutes, 0),
        storyPoints: maxOf(sessions.map((e) => e.storyPoints)),
        estimateMinutes: maxOf(sessions.map((e) => e.estimateMinutes)),
        addedAt: lastAdded(sessions),
      }
    })
    .sort(
      (a, b) =>
        Number(Boolean(b.running)) - Number(Boolean(a.running)) ||
        b.addedAt.localeCompare(a.addedAt),
    )
    .map(({ addedAt: _addedAt, ...group }) => group)
}
