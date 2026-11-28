import { maxOf } from '#/shared/domain/numbers'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { taskGroupKey } from '#/features/reports/domain/report'

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
export const isLaterSession = (entry: TimeEntry, otherEntry: TimeEntry) =>
  entry.workDate !== otherEntry.workDate
    ? entry.workDate > otherEntry.workDate
    : (entry.startTime ?? '') !== (otherEntry.startTime ?? '')
      ? (entry.startTime ?? '') > (otherEntry.startTime ?? '')
      : entry.createdAt > otherEntry.createdAt

/** Sesje pogrupowane po zadaniu, w kolejności pierwszego wystąpienia. */
export function groupEntriesByTask(
  entries: ReadonlyArray<TimeEntry>,
): Map<string, Array<TimeEntry>> {
  const groups = new Map<string, Array<TimeEntry>>()
  for (const timeEntry of entries) {
    const key = taskGroupKey(timeEntry)
    const list = groups.get(key)
    if (list) list.push(timeEntry)
    else groups.set(key, [timeEntry])
  }
  return groups
}

/** Zadania z sesji, od ostatnio ruszanego. */
export function aggregateTasks(
  entries: ReadonlyArray<TimeEntry>,
): Array<TaskAggregate> {
  return [...groupEntriesByTask(entries)]
    .map(([key, sessions]) => {
      const latest = sessions.reduce((accumulator, timeEntry) =>
        isLaterSession(timeEntry, accumulator) ? timeEntry : accumulator,
      )
      return {
        key,
        latest,
        sessions,
        workedMinutes: sessions.reduce(
          (accumulator, timeEntry) => accumulator + timeEntry.durationMinutes,
          0,
        ),
        lastDate: latest.workDate,
        finished: sessions.some((timeEntry) => timeEntry.finishedAt !== null),
        running: sessions.some((timeEntry) => timeEntry.running),
      }
    })
    .sort((left, right) => (isLaterSession(left.latest, right.latest) ? -1 : 1))
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
  const order = (timeEntry: TimeEntry) =>
    `${timeEntry.startTime ?? '99:99'}|${timeEntry.createdAt}`
  const lastAdded = (list: ReadonlyArray<TimeEntry>) =>
    list.reduce(
      (max, timeEntry) =>
        timeEntry.createdAt > max ? timeEntry.createdAt : max,
      '',
    )
  return [...groupEntriesByTask(entries)]
    .map(([key, list]) => {
      const sessions = [...list].sort((left, right) =>
        order(left).localeCompare(order(right)),
      )
      const running = sessions.find((timeEntry) => timeEntry.running)
      return {
        key,
        sessions,
        latest: sessions.at(-1)!,
        running,
        paused: !running && sessions.some((timeEntry) => timeEntry.paused),
        doneMinutes: sessions.reduce(
          (accumulator, timeEntry) => accumulator + timeEntry.durationMinutes,
          0,
        ),
        storyPoints: maxOf(sessions.map((timeEntry) => timeEntry.storyPoints)),
        estimateMinutes: maxOf(
          sessions.map((timeEntry) => timeEntry.estimateMinutes),
        ),
        addedAt: lastAdded(sessions),
      }
    })
    .sort(
      (left, right) =>
        Number(Boolean(right.running)) - Number(Boolean(left.running)) ||
        right.addedAt.localeCompare(left.addedAt),
    )
    .map(({ addedAt: _addedAt, ...group }) => group)
}
