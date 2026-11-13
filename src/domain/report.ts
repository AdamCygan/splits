import type { FieldRequirement, TaskType, TimeEntry } from '#/data/types'
import { addDays, diffDays, isValidDate, startOfWeek } from './dates'
import { extractTaskKey } from './rules'
import { maxPoints } from './summary'

/** Jeden wiersz raportu: zadanie (wszystkie jego wpisy w okresie) z SP i czasem. */
export type TaskRow = {
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
  sessions: number
  days: number
  first: string
  last: string
  running: boolean
}

export type TypeRow = {
  taskTypeId: string
  minutes: number
  storyPoints: number
  tasks: number
  /** Zadania tego typu bez SP (żeby było widać, ile pracy nie ma wyceny). */
  withoutSp: number
}

export type ReportTotals = {
  minutes: number
  /** Nadgodziny w okresie (część `minutes`). */
  overtimeMinutes: number
  storyPoints: number
  tasks: number
  /** Średni czas na 1 SP, liczony tylko z zadań, które mają SP; null = brak takich zadań. */
  minutesPerSp: number | null
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
    types.map((t) => [t.id, t.storyPointsRequirement]),
  )
  const groups = new Map<string, Array<TimeEntry>>()
  for (const entry of entries) {
    const key = taskGroupKey(entry)
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }
  return [...groups].map(([key, list]) => {
    const sorted = [...list].sort((a, b) =>
      (a.workDate + (a.startTime ?? '') + a.createdAt).localeCompare(
        b.workDate + (b.startTime ?? '') + b.createdAt,
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
      minutes: sorted.reduce((sum, e) => sum + e.durationMinutes, 0),
      overtimeMinutes: sorted.reduce(
        (sum, e) => sum + (e.overtimeMinutes ?? 0),
        0,
      ),
      overtimeNotes: sorted.flatMap((e) =>
        e.overtimeNote ? [e.overtimeNote] : [],
      ),
      sessions: sorted.length,
      days: new Set(sorted.map((e) => e.workDate)).size,
      first: sorted[0]!.workDate,
      last: latest.workDate,
      running: sorted.some((e) => e.running),
    }
  })
}

export function totalsOf(rows: ReadonlyArray<TaskRow>): ReportTotals {
  const withSp = rows.filter((r) => r.storyPoints !== null)
  const sp = withSp.reduce((sum, r) => sum + r.storyPoints!, 0)
  const spMinutes = withSp.reduce((sum, r) => sum + r.minutes, 0)
  return {
    minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
    overtimeMinutes: rows.reduce((sum, r) => sum + r.overtimeMinutes, 0),
    storyPoints: sp,
    tasks: rows.length,
    minutesPerSp: sp > 0 ? Math.round(spMinutes / sp) : null,
  }
}

export function byType(
  rows: ReadonlyArray<TaskRow>,
  typeOrder: ReadonlyArray<string>,
): Array<TypeRow> {
  const map = new Map<string, TypeRow>()
  for (const r of rows) {
    const row = map.get(r.taskTypeId) ?? {
      taskTypeId: r.taskTypeId,
      minutes: 0,
      storyPoints: 0,
      tasks: 0,
      withoutSp: 0,
    }
    row.minutes += r.minutes
    row.storyPoints += r.storyPoints ?? 0
    row.tasks += 1
    if (r.storyPoints === null) row.withoutSp += 1
    map.set(r.taskTypeId, row)
  }
  const order = (id: string) => {
    const i = typeOrder.indexOf(id)
    return i < 0 ? typeOrder.length : i
  }
  return [...map.values()].sort(
    (a, b) => order(a.taskTypeId) - order(b.taskTypeId),
  )
}

export type TaskSort = 'minutes' | 'storyPoints' | 'title' | 'last'

export function sortRows(
  rows: ReadonlyArray<TaskRow>,
  by: TaskSort,
  direction: 'asc' | 'desc',
): Array<TaskRow> {
  const sign = direction === 'asc' ? 1 : -1
  const value = (r: TaskRow) =>
    by === 'storyPoints'
      ? (r.storyPoints ?? -1)
      : by === 'minutes'
        ? r.minutes
        : 0
  return [...rows].sort((a, b) => {
    const diff =
      by === 'title'
        ? a.title.localeCompare(b.title)
        : by === 'last'
          ? a.last.localeCompare(b.last)
          : value(a) - value(b)
    return (
      diff * sign || b.minutes - a.minutes || a.title.localeCompare(b.title)
    )
  })
}

// ---------- Okresy raportu ----------

export type ReportRange = { from: string; to: string }

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
      const prev = previousMonth(month)
      return { from: prev, to: addDays(month, -1) }
    }
    case 'last_30':
      return { from: addDays(today, -29), to: today }
  }
}

function nextMonth(first: string) {
  const [y, m] = first.split('-').map(Number)
  return m === 12
    ? `${y! + 1}-01-01`
    : `${y}-${String(m! + 1).padStart(2, '0')}-01`
}

function previousMonth(first: string) {
  const [y, m] = first.split('-').map(Number)
  return m === 1
    ? `${y! - 1}-12-01`
    : `${y}-${String(m! - 1).padStart(2, '0')}-01`
}

/** Zakres jest poprawny, gdy obie daty istnieją, `from` ≤ `to` i nie przekracza roku. */
export function isValidRange(range: ReportRange) {
  if (!isValidDate(range.from) || !isValidDate(range.to)) return false
  const days = diffDays(range.from, range.to)
  return days >= 0 && days <= 366
}

// ---------- Eksport ----------

const csvCell = (value: string | number) => {
  const text = String(value)
  // Formuły w arkuszu (=, +, -, @) neutralizujemy apostrofem, żeby tytuł nie wykonał się w Excelu.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",;\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV raportu: separator przecinek, czas w minutach i godzinach dziesiętnych (do faktur i arkuszy). */
export function reportCsv(
  rows: ReadonlyArray<TaskRow>,
  labels: {
    head: ReadonlyArray<string>
    typeName: (id: string) => string
    projectName: (id: string | null) => string
  },
): string {
  const lines = [labels.head.map(csvCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.title,
        r.taskKey ?? '',
        r.link ?? '',
        labels.typeName(r.taskTypeId),
        labels.projectName(r.projectId),
        r.storyPoints ?? '',
        r.minutes,
        (r.minutes / 60).toFixed(2),
        r.sessions,
        r.days,
        r.first,
        r.last,
        r.overtimeMinutes,
        (r.overtimeMinutes / 60).toFixed(2),
        r.overtimeNotes.join(' | '),
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}
