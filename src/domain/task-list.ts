import { addDays } from './dates'
import type { TaskRow } from './report'
import type { EstimateStatus } from './sprint-stats'

export type TaskGrouping = 'kind' | 'day' | 'none'
export type TaskStatus = 'open' | 'running' | 'done'
export type TaskStatusFilter = 'all' | 'open' | 'done'

/** Stan zadania na liście: trwa (timer), zakończone (oznaczone) albo w toku. */
export const taskStatus = (
  row: Pick<TaskRow, 'key' | 'running'>,
  finished: ReadonlySet<string>,
): TaskStatus =>
  row.running ? 'running' : finished.has(row.key) ? 'done' : 'open'

export const matchesStatus = (status: TaskStatus, filter: TaskStatusFilter) =>
  filter === 'all' ||
  (filter === 'done' ? status === 'done' : status !== 'done')

export type TaskGroup<T> = {
  /** id rodzaju pracy, data (YYYY-MM-DD) albo 'all'. */
  key: string
  items: Array<T>
  minutes: number
}

/**
 * Grupy listy zadań: według rodzaju pracy (najwięcej czasu najpierw), według dnia
 * ostatniej pracy (najnowszy najpierw) albo jedna grupa. Kolejność w grupie zostaje.
 */
export function groupTaskList<T extends { row: TaskRow }>(
  items: ReadonlyArray<T>,
  by: TaskGrouping,
): Array<TaskGroup<T>> {
  if (by === 'none')
    return [
      {
        key: 'all',
        items: [...items],
        minutes: items.reduce((s, x) => s + x.row.minutes, 0),
      },
    ]
  const groups = new Map<string, TaskGroup<T>>()
  for (const item of items) {
    const key = by === 'kind' ? item.row.taskTypeId : item.row.last
    const group = groups.get(key) ?? { key, items: [], minutes: 0 }
    group.items.push(item)
    group.minutes += item.row.minutes
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) =>
    by === 'kind'
      ? b.minutes - a.minutes || a.key.localeCompare(b.key)
      : b.key.localeCompare(a.key),
  )
}

/** Okresy listy zadań (dni wstecz) i limit planu Free. */
export const TASK_PERIODS = { d30: 30, d90: 90, d365: 365 } as const
export type TaskPeriodId = keyof typeof TASK_PERIODS
/** Okres albo konkretny sprint (`sprint:<id>`). */
export type TaskPeriodChoice = TaskPeriodId | `sprint:${string}`

/**
 * Zakres dat listy zadań: sprint (do dziś, nie starszy niż limit planu) albo ostatnie
 * N dni. `oldest` = najstarszy dzień dostępny w planie (null = bez limitu).
 */
export function taskPeriodRange(options: {
  choice: TaskPeriodChoice
  sprint: { startsOn: string; endsOn: string } | undefined
  today: string
  oldest: string | null
  freeDays: number | null
}) {
  const { sprint, today, oldest } = options
  if (sprint) {
    return {
      from: oldest && sprint.startsOn < oldest ? oldest : sprint.startsOn,
      to: sprint.endsOn < today ? sprint.endsOn : today,
    }
  }
  const days =
    options.freeDays ??
    (options.choice in TASK_PERIODS
      ? TASK_PERIODS[options.choice as TaskPeriodId]
      : TASK_PERIODS.d30)
  return { from: addDays(today, -(days - 1)), to: today }
}

/** Filtry listy zadań; `query` już małymi literami i bez spacji na brzegach. */
export type TaskFilters = {
  query: string
  typeId: string
  estimate: 'all' | EstimateStatus
  status: TaskStatusFilter
}

export const NO_TASK_FILTERS: TaskFilters = {
  query: '',
  typeId: '',
  estimate: 'all',
  status: 'all',
}

/** Czy zadanie pasuje do wpisanego tekstu: tytuł, link albo numer ticketu. */
export const matchesTaskQuery = (row: TaskRow, query: string) =>
  !query ||
  row.title.toLocaleLowerCase().includes(query) ||
  (row.link?.toLocaleLowerCase().includes(query) ?? false) ||
  (row.taskKey?.toLocaleLowerCase().includes(query) ?? false)

/** Zadania po filtrach (rodzaj, wycena, stan, tekst). */
export function filterTaskRows<
  T extends { row: TaskRow; estimate: { status: EstimateStatus } | null },
>(
  rows: ReadonlyArray<T>,
  filters: TaskFilters,
  finished: ReadonlySet<string>,
): Array<T> {
  return rows.filter(
    ({ row, estimate }) =>
      (!filters.typeId || row.taskTypeId === filters.typeId) &&
      (filters.estimate === 'all' || estimate?.status === filters.estimate) &&
      matchesStatus(taskStatus(row, finished), filters.status) &&
      matchesTaskQuery(row, filters.query),
  )
}

/** Ile filtrów odbiega od domyślnych (licznik na przycisku „Filtry” na telefonie). */
export const activeFilterCount = (
  filters: TaskFilters,
  choice: TaskPeriodChoice,
) =>
  [
    filters.typeId !== '',
    filters.estimate !== 'all',
    filters.status !== 'all',
    choice !== 'd30',
  ].filter(Boolean).length
