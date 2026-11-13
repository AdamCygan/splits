import type { SpScaleStep, Sprint, TaskType, TimeEntry } from '#/data/types'
import { diffDays } from './dates'
import { byType, groupTasks, totalsOf } from './report'
import type { TaskRow, TypeRow } from './report'
import { rangeFor } from './sp-scale'

export type SprintStats = {
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
    (e) => e.workDate >= sprint.startsOn && e.workDate <= sprint.endsOn,
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
      types.map((t) => t.id),
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
    (s) => s.minutesPerSp !== null && s.storyPoints > 0,
  )
  const points = withSp.reduce((sum, s) => sum + s.storyPoints, 0)
  if (points === 0) return null
  return Math.round(
    withSp.reduce((sum, s) => sum + s.minutesPerSp! * s.storyPoints, 0) /
      points,
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
 * Czy czas zadania zmieścił się w przedziale dla jego SP (skala z Ustawień):
 * poniżej dolnej granicy = szybciej niż wycena, powyżej górnej = dłużej.
 * null = zadanie bez SP albo SP spoza skali.
 */
export function estimateOf(
  row: Pick<TaskRow, 'storyPoints' | 'minutes'>,
  scale: ReadonlyArray<Pick<SpScaleStep, 'points' | 'maxMinutes'>>,
): { status: EstimateStatus; min: number; max: number; overBy: number } | null {
  if (row.storyPoints === null) return null
  const range = rangeFor(scale, row.storyPoints)
  if (!range) return null
  const status: EstimateStatus =
    row.minutes > range.max
      ? 'over'
      : row.minutes <= range.min
        ? 'under'
        : 'within'
  return { status, ...range, overBy: Math.max(0, row.minutes - range.max) }
}
