import type { SpScaleStep } from '#/features/story-points/data/dto'

export type ScaleStepDraft = Omit<SpScaleStep, 'id'>

export const SCALE_LIMITS = {
  minPoints: 0.5,
  maxPoints: 100,
  maxMinutes: 100_000,
  maxSteps: 20,
} as const

export const scalePresets: Record<
  'fibonacci' | 'linear' | 'doubling',
  ReadonlyArray<ScaleStepDraft>
> = {
  fibonacci: [
    { points: 0.5, maxMinutes: 30 },
    { points: 1, maxMinutes: 60 },
    { points: 2, maxMinutes: 120 },
    { points: 3, maxMinutes: 240 },
    { points: 5, maxMinutes: 480 },
    { points: 8, maxMinutes: 960 },
    { points: 13, maxMinutes: 1920 },
  ],
  linear: [
    { points: 1, maxMinutes: 60 },
    { points: 2, maxMinutes: 120 },
    { points: 3, maxMinutes: 180 },
    { points: 4, maxMinutes: 240 },
    { points: 5, maxMinutes: 300 },
    { points: 6, maxMinutes: 360 },
    { points: 8, maxMinutes: 480 },
  ],
  doubling: [
    { points: 1, maxMinutes: 60 },
    { points: 2, maxMinutes: 120 },
    { points: 4, maxMinutes: 240 },
    { points: 8, maxMinutes: 480 },
    { points: 16, maxMinutes: 960 },
  ],
}

export type ScaleIssue =
  | { code: 'empty' }
  | { code: 'too_many' }
  | { code: 'points_range'; index: number }
  | { code: 'minutes_range'; index: number }
  | { code: 'duplicate_points'; index: number }
  | { code: 'not_increasing'; index: number }

/**
 * Reguły skali: wartości SP unikalne, limity czasu rosną razem z SP.
 * Indeksy to pozycje w przekazanej tablicy (formularz pokazuje błąd przy właściwym wierszu).
 */
export function validateScale(
  steps: ReadonlyArray<ScaleStepDraft>,
): Array<ScaleIssue> {
  if (steps.length === 0) return [{ code: 'empty' }]
  if (steps.length > SCALE_LIMITS.maxSteps) return [{ code: 'too_many' }]
  const issues: Array<ScaleIssue> = []
  steps.forEach((scaleStepDraft, index) => {
    if (
      !(
        scaleStepDraft.points >= SCALE_LIMITS.minPoints &&
        scaleStepDraft.points <= SCALE_LIMITS.maxPoints
      ) ||
      Math.round(scaleStepDraft.points * 10) !== scaleStepDraft.points * 10
    ) {
      issues.push({ code: 'points_range', index })
    }
    if (!(
      Number.isInteger(scaleStepDraft.maxMinutes) &&
      scaleStepDraft.maxMinutes >= 1 &&
      scaleStepDraft.maxMinutes <= SCALE_LIMITS.maxMinutes
    )) {
      issues.push({ code: 'minutes_range', index })
    }
    if (
      steps.findIndex(
        (otherStep) => otherStep.points === scaleStepDraft.points,
      ) !== index
    )
      issues.push({ code: 'duplicate_points', index })
  })
  const sorted = [...steps]
    .map((scaleStepDraft, index) => ({ ...scaleStepDraft, index }))
    .sort((left, right) => left.points - right.points)
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index]!.maxMinutes <= sorted[index - 1]!.maxMinutes)
      issues.push({ code: 'not_increasing', index: sorted[index]!.index })
  }
  return issues
}

export function sortScale<T extends ScaleStepDraft>(
  steps: ReadonlyArray<T>,
): Array<T> {
  return [...steps].sort((left, right) => left.points - right.points)
}

/** Przedział czasu dla wartości SP: od limitu poprzedniej wartości do własnego limitu. */
export function rangeFor(steps: ReadonlyArray<ScaleStepDraft>, points: number) {
  const sorted = sortScale(steps)
  const index = sorted.findIndex(
    (scaleStepDraft) => scaleStepDraft.points === points,
  )
  if (index < 0) return null
  return {
    min: index === 0 ? 0 : sorted[index - 1]!.maxMinutes,
    max: sorted[index]!.maxMinutes,
  }
}

/** Podpowiedź SP dla czasu: najmniejsza wartość, której limit mieści ten czas. */
export function suggestPoints(
  steps: ReadonlyArray<ScaleStepDraft>,
  minutes: number,
) {
  return (
    sortScale(steps).find(
      (scaleStepDraft) => minutes <= scaleStepDraft.maxMinutes,
    )?.points ?? null
  )
}

/**
 * Budżet czasu zadania: własna estymata, a bez niej górny limit czasu dla tych SP w skali
 * (np. 5 SP = do 8 h). null = bez SP i bez estymaty albo SP spoza skali.
 */
export function taskBudget(
  storyPoints: number | null,
  estimateMinutes: number | null,
  scale: ReadonlyArray<Pick<ScaleStepDraft, 'points' | 'maxMinutes'>>,
): number | null {
  if (estimateMinutes !== null) return estimateMinutes
  if (storyPoints === null) return null
  return scale.find((step) => step.points === storyPoints)?.maxMinutes ?? null
}

/**
 * Ile SP „zrobił” przepracowany czas: część budżetu przeliczona na punkty (z dokładnością
 * do 0,1), najwyżej pełne SP zadania. 3 h z 8 h przy 5 SP = 1,9 SP.
 */
export function earnedPoints(
  storyPoints: number,
  workedMinutes: number,
  budgetMinutes: number,
): number {
  if (budgetMinutes <= 0) return 0
  const share = Math.min(1, workedMinutes / budgetMinutes)
  return Math.round(storyPoints * share * 10) / 10
}
