import type { Sprint, SprintCadence } from '#/features/sprints/data/dto'
import { addDays, diffDays } from '#/shared/domain/dates'

export type SprintPhase = 'past' | 'current' | 'upcoming'

export function sprintPhase(
  sprint: Pick<Sprint, 'startsOn' | 'endsOn'>,
  today: string,
): SprintPhase {
  if (today < sprint.startsOn) return 'upcoming'
  if (today > sprint.endsOn) return 'past'
  return 'current'
}

/** Przedział dat włącznie (sprint, okres raportu). */
export interface DateSpan {
  startsOn: string
  endsOn: string
}

type Dated = DateSpan

/** Sprinty, które już się zaczęły, od najnowszego (opcjonalnie nie starsze niż `oldest`). */
export function startedSprints<TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
  oldest: string | null = null,
): Array<TSprint> {
  return sprints
    .filter(
      (sprint) =>
        sprint.startsOn <= today && (!oldest || sprint.endsOn >= oldest),
    )
    .sort((left, right) => right.startsOn.localeCompare(left.startsOn))
}

/** Sprint, który trwa dziś (albo undefined). */
export const currentSprint = <TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
) => sprints.find((sprint) => sprintPhase(sprint, today) === 'current')

/** Najbliższy sprint, który się jeszcze nie zaczął. */
export const upcomingSprint = <TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
) =>
  sprints
    .filter((sprint) => sprint.startsOn > today)
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn))[0]

/** Czy dwa przedziały dat (włącznie) nachodzą na siebie — to samo co EXCLUDE w bazie. */
export function rangesOverlap(span: DateSpan, other: DateSpan) {
  return span.startsOn <= other.endsOn && other.startsOn <= span.endsOn
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
  return Array.from({ length: count }, (_unused, index) =>
    cadenceSprint(cadence, first + index),
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
  for (let index = 1; index <= last; index++) {
    const candidate = cadenceSprint(cadence, index)
    const taken = existing.some(
      (existingSprint) =>
        existingSprint.number === index ||
        rangesOverlap(existingSprint, candidate),
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
  for (let index = 0; index < total; index++) {
    const day = new Date(
      `${addDays(sprint.startsOn, index)}T00:00:00Z`,
    ).getUTCDay()
    if (workingDays.includes(day)) count++
  }
  return count
}

/**
 * Sprinty na stronie Sprinty: bieżący, ostatnie zakończone (najnowsze pierwsze, do
 * `history`) i najbliższy przyszły. `shown` = bieżący + zakończone, `from` = pierwszy
 * dzień najstarszego z nich, `lastDay` = ostatni dzień, dla którego potrzebne są dni wolne.
 */
export function sprintOverview<TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
  history: number,
) {
  const started = startedSprints(sprints, today)
  const current = started.find((sprint) => sprint.endsOn >= today)
  const past = started
    .filter((sprint) => sprint.endsOn < today)
    .slice(0, history)
  const upcoming = upcomingSprint(sprints, today)
  const shown = current ? [current, ...past] : past
  return {
    current,
    past,
    upcoming,
    shown,
    from: shown.at(-1)?.startsOn ?? today,
    lastDay: [...shown, upcoming]
      .filter((sprint) => sprint !== undefined)
      .reduce(
        (max, sprint) => (sprint.endsOn > max ? sprint.endsOn : max),
        today,
      ),
  }
}
