import type { Sprint, SprintCadence } from '#/data/types'
import { addDays, diffDays } from './dates'

export type SprintPhase = 'past' | 'current' | 'upcoming'

export function sprintPhase(
  sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
  today: string,
): SprintPhase {
  if (today < sprint.startsOn) return 'upcoming'
  if (today > sprint.endsOn) return 'past'
  return 'current'
}

/** Czy dwa przedziały dat (włącznie) nachodzą na siebie — to samo co EXCLUDE w bazie. */
export function rangesOverlap(
  a: { startsOn: string; endsOn: string },
  b: { startsOn: string; endsOn: string },
) {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn
}

export function sprintName(pattern: string, number: number) {
  return pattern.includes('{n}')
    ? pattern.replaceAll('{n}', String(number))
    : `${pattern} ${number}`
}

/** N-ty sprint kadencji (numerowany od 1 od daty kotwicy). */
export function cadenceSprint(cadence: SprintCadence, number: number) {
  const startsOn = addDays(
    cadence.anchorDate,
    (number - 1) * cadence.lengthDays,
  )
  return {
    number,
    name: sprintName(cadence.namePattern, number),
    startsOn,
    endsOn: addDays(startsOn, cadence.lengthDays - 1),
  }
}

/** Numer sprintu kadencji obejmującego dany dzień (0 = przed kotwicą). */
export function cadenceNumberAt(cadence: SprintCadence, day: string): number {
  const offset = diffDays(cadence.anchorDate, day)
  if (offset < 0) return 0
  return Math.floor(offset / cadence.lengthDays) + 1
}

/** Podgląd kolejnych sprintów od bieżącego (do formularza kadencji). */
export function previewCadence(
  cadence: SprintCadence,
  today: string,
  count = 4,
) {
  const first = Math.max(1, cadenceNumberAt(cadence, today))
  return Array.from({ length: count }, (_, i) =>
    cadenceSprint(cadence, first + i),
  )
}

/**
 * Sprinty, które powinny istnieć dla kadencji: od pierwszego do bieżącego
 * plus `ahead` następnych (to robi job w tle w API przy auto_create).
 * Pomija sprinty kolidujące z już istniejącymi (np. utworzonymi ręcznie).
 */
export function missingCadenceSprints(
  cadence: SprintCadence,
  existing: ReadonlyArray<Pick<Sprint, 'startsOn' | 'endsOn' | 'number'>>,
  today: string,
  ahead = 1,
) {
  if (!cadence.autoCreate) return []
  const last = Math.max(1, cadenceNumberAt(cadence, today)) + ahead
  const out: Array<ReturnType<typeof cadenceSprint>> = []
  for (let n = 1; n <= last; n++) {
    const candidate = cadenceSprint(cadence, n)
    const taken = existing.some(
      (s) => s.number === n || rangesOverlap(s, candidate),
    )
    if (!taken) out.push(candidate)
  }
  return out
}

export function sprintWorkingDays(
  sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
  workingDays: ReadonlyArray<number>,
) {
  const total = diffDays(sprint.startsOn, sprint.endsOn) + 1
  let count = 0
  for (let i = 0; i < total; i++) {
    const day = new Date(`${addDays(sprint.startsOn, i)}T00:00:00Z`).getUTCDay()
    if (workingDays.includes(day)) count++
  }
  return count
}
