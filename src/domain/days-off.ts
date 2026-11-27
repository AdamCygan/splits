import type { DayOff, DayOffKind, Sprint } from '#/data/types'
import { addDays, diffDays, weekday } from './dates'

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
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const out: Array<DayOffRange> = []
  for (const day of sorted) {
    const last = out.at(-1)
    const joins =
      last &&
      last.kind === day.kind &&
      last.note === day.note &&
      Array.from({ length: diffDays(last.to, day.date) - 1 }, (_, i) =>
        addDays(last.to, i + 1),
      ).every((d) => !workingDays.includes(weekday(d)))
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
  const dates = Array.from({ length: total }, (_, i) =>
    addDays(sprint.startsOn, i),
  ).filter((d) => workingDays.includes(weekday(d)))
  const off = daysOff.filter((d) => dates.includes(d.date))
  const byKind: Partial<Record<DayOffKind, number>> = {}
  for (const d of off) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1
  return {
    working: dates.length,
    off: off.length,
    available: dates.length - off.length,
    byKind,
  }
}
