import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { addDays, diffDays, weekday } from '#/shared/domain/dates'
import { toMinutes } from '#/features/time-entries/domain/entries'
import type { TaskRow } from './report'

/**
 * Kolejność warstw w wykresach wg rodzaju pracy: dobrana walidatorem palety tak, żeby
 * sąsiednie kolory były jak najłatwiejsze do odróżnienia (także przy daltonizmie).
 * Spotkania (szary) idą na górę, gdzie mają tylko jednego sąsiada.
 */
const KIND_ORDER = [
  'task',
  'pair_programming',
  'custom',
  'additional_work',
  'code_review',
  'meeting',
] as const

export function stackOrder<T extends Pick<TaskType, 'kind' | 'sortOrder'>>(
  types: ReadonlyArray<T>,
): Array<T> {
  const rank = (key: string) => {
    const index = KIND_ORDER.indexOf(key as (typeof KIND_ORDER)[number])
    return index === -1 ? KIND_ORDER.indexOf('custom') : index
  }
  return [...types].sort(
    (left, right) =>
      rank(left.kind) - rank(right.kind) || left.sortOrder - right.sortOrder,
  )
}

export interface TimeBucket {
  /** Pierwszy dzień kubełka (dzień albo poniedziałek tygodnia). */
  from: string
  to: string
  minutes: number
  byType: Record<string, number>
}

/** Poniedziałek tygodnia, w którym jest `date`. */
const mondayOf = (date: string) => addDays(date, -((weekday(date) + 6) % 7))

/**
 * Czas w okresie podzielony na dni (do 31 dni) albo tygodnie (dłuższe okresy),
 * z rozbiciem na typy pracy. Puste dni też są kubełkami, żeby oś czasu była ciągła.
 */
export function timeBuckets(
  entries: ReadonlyArray<
    Pick<TimeEntry, 'workDate' | 'taskTypeId' | 'durationMinutes'>
  >,
  from: string,
  to: string,
): { unit: 'day' | 'week'; buckets: Array<TimeBucket> } {
  const days = diffDays(from, to) + 1
  const unit = days > 31 ? 'week' : 'day'
  const buckets: Array<TimeBucket> = []
  const start = unit === 'week' ? mondayOf(from) : from
  for (
    let index = start;
    index <= to;
    index = addDays(index, unit === 'week' ? 7 : 1)
  ) {
    const end = unit === 'week' ? addDays(index, 6) : index
    buckets.push({
      from: index,
      to: end > to ? to : end,
      minutes: 0,
      byType: {},
    })
  }
  for (const part of entries) {
    const key = unit === 'week' ? mondayOf(part.workDate) : part.workDate
    const bucket = buckets.find((timeBucket) => timeBucket.from === key)
    if (!bucket) continue
    bucket.minutes += part.durationMinutes
    bucket.byType[part.taskTypeId] =
      (bucket.byType[part.taskTypeId] ?? 0) + part.durationMinutes
  }
  return { unit, buckets }
}

/**
 * Kiedy pracujesz: minuty w siatce dzień tygodnia (0 = poniedziałek) × godzina.
 * Liczą się tylko wpisy z godzinami od–do, rozłożone na pełne godziny, w które wpadają.
 */
export function hourHeatmap(
  entries: ReadonlyArray<Pick<TimeEntry, 'workDate' | 'startTime' | 'endTime'>>,
): {
  cells: Array<Array<number>>
  max: number
  firstHour: number
  lastHour: number
} {
  const cells = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const part of entries) {
    if (!part.startTime || !part.endTime) continue
    const day = (weekday(part.workDate) + 6) % 7
    const start = toMinutes(part.startTime)
    const end = toMinutes(part.endTime)
    for (
      let index = Math.floor(start / 60);
      index * 60 < end && index < 24;
      index++
    ) {
      const overlap =
        Math.min(end, (index + 1) * 60) - Math.max(start, index * 60)
      if (overlap > 0) cells[day]![index]! += overlap
    }
  }
  const used = cells.flatMap((row) =>
    row.flatMap((minutes, hour) => (minutes > 0 ? [hour] : [])),
  )
  return {
    cells,
    max: Math.max(0, ...cells.flat()),
    firstHour: used.length ? Math.min(...used) : 8,
    lastHour: used.length ? Math.max(...used) : 17,
  }
}

export interface EstimateMiss {
  key: string
  title: string
  estimate: number
  minutes: number
  /** Dodatnie = dłużej niż estymata. */
  diff: number
}

/** Zadania z estymatą, od największego rozjazdu (ponad albo poniżej). */
export function estimateMisses(
  rows: ReadonlyArray<
    Pick<TaskRow, 'key' | 'title' | 'minutes' | 'estimateMinutes'>
  >,
  limit = 8,
): Array<EstimateMiss> {
  return rows
    .flatMap((row) =>
      row.estimateMinutes === null
        ? []
        : [
            {
              key: row.key,
              title: row.title,
              estimate: row.estimateMinutes,
              minutes: row.minutes,
              diff: row.minutes - row.estimateMinutes,
            },
          ],
    )
    .sort((left, right) => Math.abs(right.diff) - Math.abs(left.diff))
    .slice(0, limit)
}

/** „Ładne” wartości osi Y w godzinach: 0 i 3–4 równe kroki do co najmniej `max` minut. */
export function hourTicks(maxMinutes: number): Array<number> {
  const hours = Math.max(1, maxMinutes / 60)
  const step =
    [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100].find(
      (seconds) => hours / seconds <= 4,
    ) ?? Math.ceil(hours / 4)
  const top = Math.ceil(hours / step) * step
  return Array.from(
    { length: top / step + 1 },
    (_unused, index) => index * step * 60,
  )
}
