import type { Sprint, SprintCadence } from '#/features/sprints/data/dto'
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
    .filter((s) => s.startsOn <= today && (!oldest || s.endsOn >= oldest))
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
}

/** Sprint, który trwa dziś (albo undefined). */
export const currentSprint = <TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
) => sprints.find((s) => sprintPhase(s, today) === 'current')

/** Najbliższy sprint, który się jeszcze nie zaczął. */
export const upcomingSprint = <TSprint extends Dated>(
  sprints: ReadonlyArray<TSprint>,
  today: string,
) =>
  sprints
    .filter((s) => s.startsOn > today)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0]

/** Czy dwa przedziały dat (włącznie) nachodzą na siebie — to samo co EXCLUDE w bazie. */
export function rangesOverlap(a: DateSpan, b: DateSpan) {
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
  const current = started.find((s) => s.endsOn >= today)
  const past = started.filter((s) => s.endsOn < today).slice(0, history)
  const upcoming = upcomingSprint(sprints, today)
  const shown = current ? [current, ...past] : past
  return {
    current,
    past,
    upcoming,
    shown,
    from: shown.at(-1)?.startsOn ?? today,
    lastDay: [...shown, upcoming]
      .filter((x) => x !== undefined)
      .reduce((max, x) => (x.endsOn > max ? x.endsOn : max), today),
  }
}
