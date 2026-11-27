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
  const rank = (k: string) => {
    const i = KIND_ORDER.indexOf(k as (typeof KIND_ORDER)[number])
    return i === -1 ? KIND_ORDER.indexOf('custom') : i
  }
  return [...types].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || a.sortOrder - b.sortOrder,
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
  for (let d = start; d <= to; d = addDays(d, unit === 'week' ? 7 : 1)) {
    const end = unit === 'week' ? addDays(d, 6) : d
    buckets.push({ from: d, to: end > to ? to : end, minutes: 0, byType: {} })
  }
  for (const e of entries) {
    const key = unit === 'week' ? mondayOf(e.workDate) : e.workDate
    const bucket = buckets.find((b) => b.from === key)
    if (!bucket) continue
    bucket.minutes += e.durationMinutes
    bucket.byType[e.taskTypeId] =
      (bucket.byType[e.taskTypeId] ?? 0) + e.durationMinutes
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
  for (const e of entries) {
    if (!e.startTime || !e.endTime) continue
    const day = (weekday(e.workDate) + 6) % 7
    const start = toMinutes(e.startTime)
    const end = toMinutes(e.endTime)
    for (let h = Math.floor(start / 60); h * 60 < end && h < 24; h++) {
      const overlap = Math.min(end, (h + 1) * 60) - Math.max(start, h * 60)
      if (overlap > 0) cells[day]![h]! += overlap
    }
  }
  const used = cells.flatMap((row) => row.flatMap((m, h) => (m > 0 ? [h] : [])))
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
    .flatMap((r) =>
      r.estimateMinutes === null
        ? []
        : [
            {
              key: r.key,
              title: r.title,
              estimate: r.estimateMinutes,
              minutes: r.minutes,
              diff: r.minutes - r.estimateMinutes,
            },
          ],
    )
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, limit)
}

/** „Ładne” wartości osi Y w godzinach: 0 i 3–4 równe kroki do co najmniej `max` minut. */
export function hourTicks(maxMinutes: number): Array<number> {
  const hours = Math.max(1, maxMinutes / 60)
  const step =
    [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100].find((s) => hours / s <= 4) ??
    Math.ceil(hours / 4)
  const top = Math.ceil(hours / step) * step
  return Array.from({ length: top / step + 1 }, (_, i) => i * step * 60)
}
