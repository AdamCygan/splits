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
  minutesLabel: (minutes: number) => string,
): Array<GoalDraft> =>
  goals.map((sprintTimeGoal) => ({
    key: crypto.randomUUID(),
    taskTypeId: sprintTimeGoal.taskTypeId,
    time: minutesLabel(sprintTimeGoal.minutes),
  }))

/** Cele do zapisu albo null, gdy któryś wiersz jest niepoprawny. */
export function goalsFromDrafts(
  rows: ReadonlyArray<GoalDraft>,
): Array<SprintTimeGoal> | null {
  const goals = rows.map((goalDraft) => ({
    taskTypeId: goalDraft.taskTypeId,
    minutes: parseDuration(goalDraft.time) ?? 0,
  }))
  return goals.every((goal) => goal.taskTypeId && goal.minutes > 0)
    ? goals
    : null
}
