import type { DayOff, DayOffKind } from '#/features/days-off/data/dto'
import type { Sprint } from '#/features/sprints/data/dto'
import { addDays, diffDays, weekday } from '#/shared/domain/dates'

export interface DayOffRange {
  from: string
  to: string
  kind: DayOffKind
  note: string | null
  /** Dni wolne w zakresie (bez weekendów, które go tylko łączą). */
  days: number
}

/**
 * Łączy dni wolne w zakresy: ten sam rodzaj i notatka, a między dniami tylko dni spoza
 * dni pracy (urlop pn–pt + pn–pt to jeden zakres przez weekend).
 */
export function groupDaysOff(
  days: ReadonlyArray<DayOff>,
  workingDays: ReadonlyArray<number>,
): Array<DayOffRange> {
  const sorted = [...days].sort((left, right) =>
    left.date.localeCompare(right.date),
  )
  const out: Array<DayOffRange> = []
  for (const day of sorted) {
    const last = out.at(-1)
    const joins =
      last &&
      last.kind === day.kind &&
      last.note === day.note &&
      Array.from(
        { length: diffDays(last.to, day.date) - 1 },
        (_unused, index) => addDays(last.to, index + 1),
      ).every((part) => !workingDays.includes(weekday(part)))
    if (last && joins) {
      last.to = day.date
      last.days++
    } else out.push({ ...day, from: day.date, to: day.date, days: 1 })
  }
  return out
}

/** Dni robocze sprintu, ile z nich to dni wolne (wg rodzaju) i ile zostaje do pracy. */
export function sprintAvailability(
  sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
  workingDays: ReadonlyArray<number>,
  daysOff: ReadonlyArray<DayOff>,
) {
  const total = diffDays(sprint.startsOn, sprint.endsOn) + 1
  const dates = Array.from({ length: total }, (_unused, index) =>
    addDays(sprint.startsOn, index),
  ).filter((part) => workingDays.includes(weekday(part)))
  const off = daysOff.filter((dayOff) => dates.includes(dayOff.date))
  const byKind: Partial<Record<DayOffKind, number>> = {}
  for (const dayOff of off) byKind[dayOff.kind] = (byKind[dayOff.kind] ?? 0) + 1
  return {
    working: dates.length,
    off: off.length,
    available: dates.length - off.length,
    byKind,
  }
}
