import { percentOf } from './numbers'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { addDays } from './dates'
import { groupTasks, totalsOf } from './report'

/**
 * Dzień, który pokazuje strona Dziś: z adresu, ale nie z przyszłości i nie starszy niż
 * pozwala plan (Free: ostatnie `historyDays` dni). `minDate` null = bez limitu.
 */
export function clampWorkDate(
  date: string | undefined,
  today: string,
  minDate: string | null,
) {
  if (!date || date > today) return today
  return minDate !== null && date < minDate ? minDate : date
}

/** Najstarszy dzień do dopisania wpisów przy limicie historii (null = bez limitu). */
export const historyStart = (today: string, historyDays: number | null) =>
  historyDays === null ? null : addDays(today, -(historyDays - 1))

/** Liczby nad listą dnia: czas, SP (zadanie liczy się raz), wpisy i postęp do celu. */
export function dayTotals(
  entries: ReadonlyArray<TimeEntry>,
  types: ReadonlyArray<TaskType>,
  targetMinutes: number,
) {
  const minutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0)
  return {
    minutes,
    storyPoints: totalsOf(groupTasks(entries, types)).storyPoints,
    entries: entries.length,
    targetMinutes,
    /** Procent celu dnia (0–100); 0, gdy cel jest wyłączony. */
    progress: percentOf(minutes, targetMinutes, true),
  }
}
