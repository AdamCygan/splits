import type { SpScaleStep } from '#/features/story-points/data/dto'
import type { Sprint, SprintTimeGoal } from '#/features/sprints/data/dto'
import type { TaskType } from '#/features/task-types/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { diffDays } from '#/shared/domain/dates'
import { byType, groupTasks, totalsOf } from '#/features/reports/domain/report'
import type { TaskRow, TypeRow } from '#/features/reports/domain/report'
import { rangeFor } from '#/features/story-points/domain/sp-scale'

export interface SprintStats {
  sprint: Sprint
  minutes: number
  /** Nadgodziny w sprincie (część `minutes`). */
  overtimeMinutes: number
  storyPoints: number
  tasks: number
  /** Średni czas na 1 SP (tylko zadania z SP); null = brak takich zadań. */
  minutesPerSp: number | null
  types: Array<TypeRow>
}

/** Liczby jednego sprintu z wpisów, których dzień mieści się w jego datach. */
export function sprintStats(
  sprint: Sprint,
  entries: ReadonlyArray<TimeEntry>,
  types: ReadonlyArray<Pick<TaskType, 'id' | 'storyPointsRequirement'>>,
): SprintStats {
  const own = entries.filter(
    (timeEntry) =>
      timeEntry.workDate >= sprint.startsOn &&
      timeEntry.workDate <= sprint.endsOn,
  )
  const rows = groupTasks(own, types)
  const totals = totalsOf(rows)
  return {
    sprint,
    minutes: totals.minutes,
    overtimeMinutes: totals.overtimeMinutes,
    storyPoints: totals.storyPoints,
    tasks: totals.tasks,
    minutesPerSp: totals.minutesPerSp,
    types: byType(
      rows,
      types.map((type) => type.id),
    ),
  }
}

/**
 * Średni czas na 1 SP z kilku sprintów, ważony liczbą SP (sprint z 30 SP waży więcej niż z 3).
 * Liczone z czasu zadań, które mają SP: spotkania i review bez SP nie zawyżają wyniku.
 */
export function averageMinutesPerSp(
  stats: ReadonlyArray<Pick<SprintStats, 'minutesPerSp' | 'storyPoints'>>,
): number | null {
  const withSp = stats.filter(
    (stat) => stat.minutesPerSp !== null && stat.storyPoints > 0,
  )
  const points = withSp.reduce((sum, sprint) => sum + sprint.storyPoints, 0)
  const hasNoPoints = points === 0
  if (hasNoPoints) return null
  return Math.round(
    withSp.reduce(
      (sum, sprint) => sum + sprint.minutesPerSp! * sprint.storyPoints,
      0,
    ) / points,
  )
}

/** Który dzień sprintu jest dziś (1 = pierwszy) i ile ma dni; po sprincie day = total. */
export function sprintDay(
  sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
  today: string,
) {
  const total = diffDays(sprint.startsOn, sprint.endsOn) + 1
  const day = Math.min(total, Math.max(1, diffDays(sprint.startsOn, today) + 1))
  return { day, total }
}

export type EstimateStatus = 'under' | 'within' | 'over'

/**
 * Czy zadanie zmieściło się w wycenie. Własna estymata (podana przed pracą) ma pierwszeństwo:
 * powyżej niej = dłużej, poniżej 80% = szybciej. Bez estymaty: przedział czasu dla SP ze skali
 * w Ustawieniach. null = brak estymaty i SP albo SP spoza skali.
 */
export function estimateOf(
  row: Pick<TaskRow, 'storyPoints' | 'minutes'> &
    Partial<Pick<TaskRow, 'estimateMinutes'>>,
  scale: ReadonlyArray<Pick<SpScaleStep, 'points' | 'maxMinutes'>>,
): {
  status: EstimateStatus
  min: number
  max: number
  overBy: number
  source: 'estimate' | 'scale'
} | null {
  const own = row.estimateMinutes ?? null
  const hasOwnStats = own !== null
  if (hasOwnStats) {
    const min = Math.floor(own * 0.8)
    const status: EstimateStatus =
      row.minutes > own ? 'over' : row.minutes < min ? 'under' : 'within'
    return {
      status,
      min,
      max: own,
      overBy: Math.max(0, row.minutes - own),
      source: 'estimate',
    }
  }
  const { storyPoints } = row
  const isUnestimated = storyPoints === null
  if (isUnestimated) return null
  const range = rangeFor(scale, storyPoints)
  if (!range) return null
  const status: EstimateStatus =
    row.minutes > range.max
      ? 'over'
      : row.minutes <= range.min
        ? 'under'
        : 'within'
  return {
    status,
    ...range,
    overBy: Math.max(0, row.minutes - range.max),
    source: 'scale',
  }
}

export interface GoalProgress {
  taskTypeId: string
  goal: number
  minutes: number
  left: number
  /** Ile powinno już być przy równym tempie (do `day` z `total` dni sprintu). */
  expected: number
  status: 'done' | 'onTrack' | 'behind'
}

/**
 * Postęp celów czasowych sprintu: przepracowany czas danego rodzaju pracy względem celu
 * i tempa (cel rozłożony równo na dni sprintu). Mniej niż 90% oczekiwanego = „w tyle”.
 */
export function timeGoalProgress(
  goals: ReadonlyArray<SprintTimeGoal>,
  types: ReadonlyArray<Pick<TypeRow, 'taskTypeId' | 'minutes'>>,
  day: number,
  total: number,
): Array<GoalProgress> {
  return goals.map((sprintTimeGoal) => {
    const minutes =
      types.find((type) => type.taskTypeId === sprintTimeGoal.taskTypeId)
        ?.minutes ?? 0
    const expected = Math.round(
      (sprintTimeGoal.minutes * day) / Math.max(1, total),
    )
    return {
      taskTypeId: sprintTimeGoal.taskTypeId,
      goal: sprintTimeGoal.minutes,
      minutes,
      left: Math.max(0, sprintTimeGoal.minutes - minutes),
      expected,
      status:
        minutes >= sprintTimeGoal.minutes
          ? 'done'
          : minutes >= expected * 0.9
            ? 'onTrack'
            : 'behind',
    }
  })
}
