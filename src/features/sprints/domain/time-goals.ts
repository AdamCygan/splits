import type { SprintTimeGoal } from '#/features/sprints/data/dto'
import { parseDuration } from '#/features/time-entries/domain/entries'

/** Wiersz formularza: rodzaj pracy i czas wpisany po ludzku („6h”, „1h 30m”, „90”). */
export interface GoalDraft {
  key: string
  taskTypeId: string
  time: string
}

export const goalDrafts = (
  goals: ReadonlyArray<SprintTimeGoal>,
  minutesLabel: (m: number) => string,
): Array<GoalDraft> =>
  goals.map((g) => ({
    key: crypto.randomUUID(),
    taskTypeId: g.taskTypeId,
    time: minutesLabel(g.minutes),
  }))

/** Cele do zapisu albo null, gdy któryś wiersz jest niepoprawny. */
export function goalsFromDrafts(
  rows: ReadonlyArray<GoalDraft>,
): Array<SprintTimeGoal> | null {
  const goals = rows.map((r) => ({
    taskTypeId: r.taskTypeId,
    minutes: parseDuration(r.time) ?? 0,
  }))
  return goals.every((g) => g.taskTypeId && g.minutes > 0) ? goals : null
}
