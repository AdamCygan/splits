import type { UserSettings } from '#/features/settings/data/dto'
import { percentOf } from '#/shared/domain/numbers'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { addDays } from '#/shared/domain/dates'
import { groupTasks, totalsOf } from '#/features/reports/domain/report'

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
  const minutes = entries.reduce(
    (sum, timeEntry) => sum + timeEntry.durationMinutes,
    0,
  )
  return {
    minutes,
    storyPoints: totalsOf(groupTasks(entries, types)).storyPoints,
    entries: entries.length,
    targetMinutes,
    /** Procent celu dnia (0–100); 0, gdy cel jest wyłączony. */
    progress: percentOf(minutes, targetMinutes, true),
  }
}

/** Pola dnia pracy, które należą do przestrzeni (reszta ustawień należy do konta). */
export const WORKSPACE_DAY_FIELDS = [
  'workdayTargetMinutes',
  'workingDays',
  'timeRoundingMinutes',
  'breakMinutes',
  'summaryTemplate',
] as const satisfies ReadonlyArray<keyof UserSettings>

/** Czy zapis zmienia coś w dniu pracy przestrzeni (wtedy pytamy, gdzie zastosować). */
export function workdayChanged(before: UserSettings, after: UserSettings) {
  return WORKSPACE_DAY_FIELDS.some(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  )
}
