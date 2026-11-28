import type { TimeEntry } from '#/features/time-entries/data/dto'
import { diffDays } from '#/shared/domain/dates'
import type { MinuteRange } from '#/features/day/domain/day-summary'
import { toMinutes } from '#/features/time-entries/domain/entries'

export interface TaskDay {
  date: string
  minutes: number
  sessions: number
}

/** Coś, co wcisnęło się między dwie sesje zadania tego samego dnia. */
export interface Interrupter {
  title: string
  taskTypeId: string
  minutes: number
  /** W ilu przerwach zadania się pojawiło. */
  times: number
}

/** Przerwa w zadaniu: koniec jednej sesji, start kolejnej tego samego dnia, i co było pomiędzy. */
export interface TaskGap {
  date: string
  from: string
  to: string
  minutes: number
  between: Array<
    Pick<TimeEntry, 'id' | 'title' | 'taskTypeId'> & { minutes: number }
  >
}

export interface TaskInsights {
  minutes: number
  sessions: number
  days: Array<TaskDay>
  firstDate: string
  lastDate: string
  /** Dni kalendarzowe od pierwszej do ostatniej sesji (włącznie). */
  spanDays: number
  averageSession: number
  longestSession: number
  shortestSession: number
  /** Ile razy wracałeś do zadania po czymś innym (przerwy między sesjami tego samego dnia). */
  gaps: Array<TaskGap>
  /** Średnio ile minut pracy przypada na jedno przerwanie (null = bez przerwań). */
  minutesPerInterruption: number | null
  interruptedBy: Array<Interrupter>
  overtimeMinutes: number
  extensionMinutes: number
}

const interval = (timeEntry: Pick<TimeEntry, 'startTime' | 'endTime'>) =>
  timeEntry.startTime && timeEntry.endTime
    ? {
        start: toMinutes(timeEntry.startTime),
        end: toMinutes(timeEntry.endTime),
      }
    : null

/**
 * Podsumowanie jednego zadania: czas, sesje, dni pracy i przerwania. `sessions` to wpisy
 * zadania, `sameDays` to wszystkie wpisy z dni, w których przy nim pracowałeś (także inne
 * zadania): z nich wiadomo, co wcisnęło się między sesje.
 */
export function taskInsights(
  sessions: ReadonlyArray<TimeEntry>,
  sameDays: ReadonlyArray<TimeEntry>,
): TaskInsights | null {
  if (sessions.length === 0) return null
  const ids = new Set(sessions.map((timeEntry) => timeEntry.id))
  const sorted = [...sessions].sort((left, right) =>
    (left.workDate + (left.startTime ?? '99:99')).localeCompare(
      right.workDate + (right.startTime ?? '99:99'),
    ),
  )
  const durations = sorted.map((timeEntry) => timeEntry.durationMinutes)
  const minutes = durations.reduce(
    (accumulator, duration) => accumulator + duration,
    0,
  )

  const byDate = new Map<string, Array<TimeEntry>>()
  for (const timeEntry of sorted)
    byDate.set(timeEntry.workDate, [
      ...(byDate.get(timeEntry.workDate) ?? []),
      timeEntry,
    ])
  const days = [...byDate.entries()].map(([date, list]) => ({
    date,
    minutes: list.reduce(
      (sum, timeEntry) => sum + timeEntry.durationMinutes,
      0,
    ),
    sessions: list.length,
  }))

  const gaps: Array<TaskGap> = []
  for (const [date, list] of byDate) {
    const timed = list
      .map((timeEntry) => ({ s: timeEntry, at: interval(timeEntry) }))
      .filter((point) => point.at !== null)
      .sort((left, right) => left.at!.start - right.at!.start)
    for (let index = 1; index < timed.length; index++) {
      const previous = timed[index - 1]!.at!
      const next = timed[index]!.at!
      if (next.start <= previous.end) continue
      const between = sameDays
        .filter(
          (timeEntry) => timeEntry.workDate === date && !ids.has(timeEntry.id),
        )
        .flatMap((timeEntry) => {
          const at = interval(timeEntry)
          if (!at) return []
          const overlap =
            Math.min(at.end, next.start) - Math.max(at.start, previous.end)
          return overlap > 0
            ? [
                {
                  id: timeEntry.id,
                  title: timeEntry.title,
                  taskTypeId: timeEntry.taskTypeId,
                  minutes: overlap,
                },
              ]
            : []
        })
      gaps.push({
        date,
        from: timed[index - 1]!.s.endTime!,
        to: timed[index]!.s.startTime!,
        minutes: next.start - previous.end,
        between,
      })
    }
  }

  const interrupters = new Map<string, Interrupter>()
  for (const gap of gaps)
    for (const interruption of gap.between) {
      const key = `${interruption.taskTypeId}|${interruption.title}`
      const known = interrupters.get(key)
      if (known) {
        known.minutes += interruption.minutes
        known.times++
      } else
        interrupters.set(key, {
          title: interruption.title,
          taskTypeId: interruption.taskTypeId,
          minutes: interruption.minutes,
          times: 1,
        })
    }

  const firstDate = sorted[0]!.workDate
  const lastDate = sorted.at(-1)!.workDate
  return {
    minutes,
    sessions: sorted.length,
    days,
    firstDate,
    lastDate,
    spanDays: diffDays(firstDate, lastDate) + 1,
    averageSession: Math.round(minutes / sorted.length),
    longestSession: Math.max(...durations),
    shortestSession: Math.min(...durations),
    gaps,
    minutesPerInterruption:
      gaps.length > 0 ? Math.round(minutes / gaps.length) : null,
    interruptedBy: [...interrupters.values()].sort(
      (left, right) => right.minutes - left.minutes,
    ),
    overtimeMinutes: sorted.reduce(
      (accumulator, timeEntry) =>
        accumulator + (timeEntry.overtimeMinutes ?? 0),
      0,
    ),
    extensionMinutes: sorted.reduce(
      (accumulator, timeEntry) =>
        accumulator + (timeEntry.extensionMinutes ?? 0),
      0,
    ),
  }
}

/** Odcinek na osi dnia zadania: wpis z godzinami (`own` = sesja tego zadania). */
export interface TaskDaySegment<TEntry> {
  entry: TEntry
  start: number
  end: number
  own: boolean
}

/**
 * Oś jednego dnia zadania: wszystkie wpisy z godzinami tego dnia (sesje zadania i inna
 * praca), zakres osi od najwcześniejszego do najpóźniejszego (co najmniej godzina) i czas
 * sesji zadania bez godzin.
 */
export function taskDayTimeline<
  TEntry extends Pick<
    TimeEntry,
    'id' | 'workDate' | 'startTime' | 'endTime' | 'durationMinutes'
  >,
>(
  date: string,
  sessions: ReadonlyArray<TEntry>,
  sameDays: ReadonlyArray<TEntry>,
) {
  const own = new Set(sessions.map((session) => session.id))
  const segments: Array<TaskDaySegment<TEntry>> = sameDays.flatMap((sameDay) =>
    sameDay.workDate === date && sameDay.startTime && sameDay.endTime
      ? [
          {
            entry: sameDay,
            start: toMinutes(sameDay.startTime),
            end: toMinutes(sameDay.endTime),
            own: own.has(sameDay.id),
          },
        ]
      : [],
  )
  const from = Math.min(
    ...segments.map((taskDaySegment) => taskDaySegment.start),
    24 * 60,
  )
  const to = Math.max(
    ...segments.map((taskDaySegment) => taskDaySegment.end),
    0,
  )
  const span = Math.max(60, to - from)
  return {
    segments,
    from,
    to,
    untimedMinutes: sessions
      .filter(
        (session) =>
          session.workDate === date && !(session.startTime && session.endTime),
      )
      .reduce((sum, session) => sum + session.durationMinutes, 0),
    /** Pozycja i szerokość odcinka na osi (w procentach). */
    place: (minuteRange: MinuteRange) => ({
      left: ((minuteRange.start - from) / span) * 100,
      width: (Math.max(1, minuteRange.end - minuteRange.start) / span) * 100,
    }),
  }
}

export type TaskNoteKind = 'note' | 'overtime' | 'extension'

/** Notatki z sesji zadania (notatka, powód nadgodzin, powód przedłużenia), od najstarszej. */
export function taskNotes(
  sessions: ReadonlyArray<
    Pick<
      TimeEntry,
      | 'id'
      | 'workDate'
      | 'startTime'
      | 'endTime'
      | 'durationMinutes'
      | 'note'
      | 'overtimeNote'
      | 'extensionNote'
    >
  >,
) {
  return sessions.flatMap((session) =>
    (
      [
        ['note', session.note],
        ['overtime', session.overtimeNote],
        ['extension', session.extensionNote],
      ] as const
    )
      .filter(([, text]) => Boolean(text))
      .map(([kind, text]) => ({
        id: `${session.id}-${kind}`,
        kind,
        text: text!,
        entryId: session.id,
        date: session.workDate,
        start: session.startTime,
        end: session.endTime,
        minutes: session.durationMinutes,
      })),
  )
}
