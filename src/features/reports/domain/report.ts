import type { FieldRequirement, TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import {
  addDays,
  diffDays,
  isValidDate,
  startOfWeek,
} from '#/shared/domain/dates'
import { toCsv } from '#/shared/domain/csv'
import { elapsedSeconds } from '#/features/time-entries/domain/entries'
import { extractTaskKey } from '#/features/task-types/domain/rules'
import { maxEstimate, maxPoints } from '#/features/tasks/domain/summary'

/** Jeden wiersz raportu: zadanie (wszystkie jego wpisy w okresie) z SP i czasem. */
export interface TaskRow {
  key: string
  title: string
  link: string | null
  taskKey: string | null
  taskTypeId: string
  projectId: string | null
  /** SP zadania (największa wartość z wpisów); null = bez SP albo typ bez SP. */
  storyPoints: number | null
  minutes: number
  /** Ile z `minutes` to nadgodziny (0 = brak). */
  overtimeMinutes: number
  /** Opisy nadgodzin z wpisów zadania, od najstarszego. */
  overtimeNotes: Array<string>
  /** Estymata zadania podana przed pracą (największa z wpisów); null = brak. */
  estimateMinutes: number | null
  /** Ile z `minutes` to przedłużenia ponad plan (0 = brak) i ich powody. */
  extensionMinutes: number
  extensionNotes: Array<string>
  sessions: number
  days: number
  first: string
  last: string
  running: boolean
}

export interface TypeRow {
  taskTypeId: string
  minutes: number
  storyPoints: number
  tasks: number
  /** Zadania tego typu bez SP (żeby było widać, ile pracy nie ma wyceny). */
  withoutSp: number
}

export interface ReportTotals {
  minutes: number
  /** Nadgodziny w okresie (część `minutes`). */
  overtimeMinutes: number
  storyPoints: number
  tasks: number
  /** Średni czas na 1 SP, liczony tylko z zadań, które mają SP; null = brak takich zadań. */
  minutesPerSp: number | null
  /** Przedłużenia w okresie (część `minutes`). */
  extensionMinutes: number
  /** Zadania z estymatą: ile ich jest, suma estymat i suma ich prawdziwego czasu. */
  estimated: { tasks: number; estimateMinutes: number; actualMinutes: number }
}

/** Klucz zadania jak w `sameTask`: ten sam link, a bez linku ten sam typ i tytuł. */
export function taskGroupKey(
  entry: Pick<TimeEntry, 'link' | 'title' | 'taskTypeId'>,
) {
  const link = entry.link?.trim()
  return link
    ? `link:${link}`
    : `title:${entry.taskTypeId}:${entry.title.trim().toLocaleLowerCase()}`
}

/** SP liczą się w raporcie tylko dla typów, które mają SP (ukryte = zawsze bez SP). */
export function countsSp(requirement: FieldRequirement | undefined) {
  return requirement !== 'hidden'
}

/** Wartość SP do zapisania dla typu: typ bez SP zawsze dostaje null. */
export function spForType(
  type:
    Pick<TaskType, 'storyPointsRequirement' | 'defaultStoryPoints'> | undefined,
  value: number | null | undefined,
): number | null {
  if (!type || type.storyPointsRequirement === 'hidden') return null
  const points = value ?? type.defaultStoryPoints
  if (points !== null) return points
  return type.storyPointsRequirement === 'required' ? 1 : null
}

export function groupTasks(
  entries: ReadonlyArray<TimeEntry>,
  types: ReadonlyArray<Pick<TaskType, 'id' | 'storyPointsRequirement'>>,
): Array<TaskRow> {
  const requirement = new Map(
    types.map((type) => [type.id, type.storyPointsRequirement]),
  )
  const groups = new Map<string, Array<TimeEntry>>()
  for (const entry of entries) {
    const key = taskGroupKey(entry)
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }
  return [...groups].map(([key, list]) => {
    const sorted = [...list].sort((left, right) =>
      (left.workDate + (left.startTime ?? '') + left.createdAt).localeCompare(
        right.workDate + (right.startTime ?? '') + right.createdAt,
      ),
    )
    const latest = sorted.at(-1)!
    return {
      key,
      title: latest.title,
      link: latest.link,
      taskKey: latest.link ? extractTaskKey(latest.link) : null,
      taskTypeId: latest.taskTypeId,
      projectId: latest.projectId,
      storyPoints: countsSp(requirement.get(latest.taskTypeId))
        ? maxPoints(sorted)
        : null,
      minutes: sorted.reduce(
        (sum, timeEntry) => sum + timeEntry.durationMinutes,
        0,
      ),
      overtimeMinutes: sorted.reduce(
        (sum, timeEntry) => sum + (timeEntry.overtimeMinutes ?? 0),
        0,
      ),
      overtimeNotes: sorted.flatMap((timeEntry) =>
        timeEntry.overtimeNote ? [timeEntry.overtimeNote] : [],
      ),
      estimateMinutes: maxEstimate(sorted),
      extensionMinutes: sorted.reduce(
        (sum, timeEntry) => sum + (timeEntry.extensionMinutes ?? 0),
        0,
      ),
      extensionNotes: sorted.flatMap((timeEntry) =>
        timeEntry.extensionNote ? [timeEntry.extensionNote] : [],
      ),
      sessions: sorted.length,
      days: new Set(sorted.map((timeEntry) => timeEntry.workDate)).size,
      first: sorted[0]!.workDate,
      last: latest.workDate,
      running: sorted.some((timeEntry) => timeEntry.running),
    }
  })
}

export function totalsOf(rows: ReadonlyArray<TaskRow>): ReportTotals {
  const withSp = rows.filter((taskRow) => taskRow.storyPoints !== null)
  const storyPoints = withSp.reduce(
    (sum, taskRow) => sum + taskRow.storyPoints!,
    0,
  )
  const spMinutes = withSp.reduce((sum, taskRow) => sum + taskRow.minutes, 0)
  return {
    minutes: rows.reduce((sum, taskRow) => sum + taskRow.minutes, 0),
    overtimeMinutes: rows.reduce(
      (sum, taskRow) => sum + taskRow.overtimeMinutes,
      0,
    ),
    storyPoints,
    tasks: rows.length,
    minutesPerSp: storyPoints > 0 ? Math.round(spMinutes / storyPoints) : null,
    extensionMinutes: rows.reduce(
      (sum, taskRow) => sum + taskRow.extensionMinutes,
      0,
    ),
    estimated: rows.reduce(
      (accumulator, taskRow) =>
        taskRow.estimateMinutes === null
          ? accumulator
          : {
              tasks: accumulator.tasks + 1,
              estimateMinutes:
                accumulator.estimateMinutes + taskRow.estimateMinutes,
              actualMinutes: accumulator.actualMinutes + taskRow.minutes,
            },
      { tasks: 0, estimateMinutes: 0, actualMinutes: 0 },
    ),
  }
}

export function byType(
  rows: ReadonlyArray<TaskRow>,
  typeOrder: ReadonlyArray<string>,
): Array<TypeRow> {
  const map = new Map<string, TypeRow>()
  for (const taskRow of rows) {
    const row = map.get(taskRow.taskTypeId) ?? {
      taskTypeId: taskRow.taskTypeId,
      minutes: 0,
      storyPoints: 0,
      tasks: 0,
      withoutSp: 0,
    }
    row.minutes += taskRow.minutes
    row.storyPoints += taskRow.storyPoints ?? 0
    row.tasks += 1
    if (taskRow.storyPoints === null) row.withoutSp += 1
    map.set(taskRow.taskTypeId, row)
  }
  const order = (id: string) => {
    const index = typeOrder.indexOf(id)
    return index < 0 ? typeOrder.length : index
  }
  return [...map.values()].sort(
    (left, right) => order(left.taskTypeId) - order(right.taskTypeId),
  )
}

export type TaskSort = 'minutes' | 'storyPoints' | 'title' | 'last'

export function sortRows(
  rows: ReadonlyArray<TaskRow>,
  by: TaskSort,
  direction: 'asc' | 'desc',
): Array<TaskRow> {
  const sign = direction === 'asc' ? 1 : -1
  const value = (taskRow: TaskRow) =>
    by === 'storyPoints'
      ? (taskRow.storyPoints ?? -1)
      : by === 'minutes'
        ? taskRow.minutes
        : 0
  return [...rows].sort((left, right) => {
    const diff =
      by === 'title'
        ? left.title.localeCompare(right.title)
        : by === 'last'
          ? left.last.localeCompare(right.last)
          : value(left) - value(right)
    return (
      diff * sign ||
      right.minutes - left.minutes ||
      left.title.localeCompare(right.title)
    )
  })
}

export interface SortState {
  by: TaskSort
  dir: 'asc' | 'desc'
}

/** Klik w nagłówek: ta sama kolumna odwraca kierunek, nowa startuje od naturalnego (tytuł A→Z, liczby malejąco). */
export const nextSort = (sort: SortState, by: TaskSort): SortState =>
  sort.by === by
    ? { by, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
    : { by, dir: by === 'title' ? 'asc' : 'desc' }

/** Działający timer liczymy do teraz, żeby raport nie pokazywał 0 minut. */
export const withElapsed = (
  entries: ReadonlyArray<TimeEntry>,
  now: number,
): Array<TimeEntry> =>
  entries.map((timeEntry) =>
    timeEntry.running
      ? {
          ...timeEntry,
          durationMinutes: Math.floor(
            elapsedSeconds(timeEntry.startedAt, now) / 60,
          ),
        }
      : timeEntry,
  )

// ---------- Okresy raportu ----------

export interface ReportRange {
  from: string
  to: string
}

export type PeriodPreset =
  'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_30'

export function presetRange(
  preset: PeriodPreset,
  today: string,
  weekStartsOn: number,
): ReportRange {
  const week = startOfWeek(today, weekStartsOn)
  const month = `${today.slice(0, 8)}01`
  switch (preset) {
    case 'this_week':
      return { from: week, to: addDays(week, 6) }
    case 'last_week':
      return { from: addDays(week, -7), to: addDays(week, -1) }
    case 'this_month':
      return { from: month, to: addDays(nextMonth(month), -1) }
    case 'last_month': {
      const previous = previousMonth(month)
      return { from: previous, to: addDays(month, -1) }
    }
    case 'last_30':
      return { from: addDays(today, -29), to: today }
  }
}

function nextMonth(first: string) {
  const [year, month] = first.split('-').map(Number)
  return month === 12
    ? `${year! + 1}-01-01`
    : `${year}-${String(month! + 1).padStart(2, '0')}-01`
}

function previousMonth(first: string) {
  const [year, month] = first.split('-').map(Number)
  return month === 1
    ? `${year! - 1}-12-01`
    : `${year}-${String(month! - 1).padStart(2, '0')}-01`
}

export const REPORT_PRESETS: ReadonlyArray<PeriodPreset> = [
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_30',
]

/** Okres raportu: sprint, gotowy zakres kalendarza albo własne daty. */
export type ReportPeriod = `sprint:${string}` | PeriodPreset | 'custom'

export interface ReportRangeOptions {
  period: ReportPeriod
  sprint: { startsOn: string; endsOn: string } | undefined
  custom: ReportRange
  today: string
  weekStartsOn: number
  oldest: string | null
}

/**
 * Daty raportu dla wybranego okresu, przycięte do historii planu (`oldest`, null = bez
 * limitu). `clamped` mówi, że część okresu jest poza planem (pokazujemy wtedy informację).
 */
export function reportRange(options: ReportRangeOptions): {
  range: ReportRange
  clamped: boolean
} {
  const { period, sprint, oldest } = options
  const requested: ReportRange = sprint
    ? { from: sprint.startsOn, to: sprint.endsOn }
    : period === 'custom'
      ? options.custom
      : presetRange(period as PeriodPreset, options.today, options.weekStartsOn)
  const clamped = oldest !== null && requested.from < oldest
  return {
    range: clamped ? { ...requested, from: oldest } : requested,
    clamped,
  }
}

/** Zakres jest poprawny, gdy obie daty istnieją, `from` ≤ `to` i nie przekracza roku. */
export function isValidRange(range: ReportRange) {
  if (!isValidDate(range.from) || !isValidDate(range.to)) return false
  const days = diffDays(range.from, range.to)
  return days >= 0 && days <= 366
}

// ---------- Eksport ----------

export interface ReportCsvLabels {
  head: ReadonlyArray<string>
  typeName: (id: string) => string
  projectName: (id: string | null) => string
}

/** CSV raportu: separator przecinek, czas w minutach i godzinach dziesiętnych (do faktur i arkuszy). */
export function reportCsv(
  rows: ReadonlyArray<TaskRow>,
  labels: ReportCsvLabels,
): string {
  return toCsv([
    labels.head,
    ...rows.map((taskRow) => [
      taskRow.title,
      taskRow.taskKey ?? '',
      taskRow.link ?? '',
      labels.typeName(taskRow.taskTypeId),
      labels.projectName(taskRow.projectId),
      taskRow.storyPoints ?? '',
      taskRow.minutes,
      (taskRow.minutes / 60).toFixed(2),
      taskRow.sessions,
      taskRow.days,
      taskRow.first,
      taskRow.last,
      taskRow.overtimeMinutes,
      (taskRow.overtimeMinutes / 60).toFixed(2),
      taskRow.overtimeNotes.join(' | '),
      taskRow.estimateMinutes ?? '',
      taskRow.estimateMinutes === null
        ? ''
        : taskRow.minutes - taskRow.estimateMinutes,
      taskRow.extensionMinutes,
      taskRow.extensionNotes.join(' | '),
    ]),
  ])
}
