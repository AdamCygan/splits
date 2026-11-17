import type { TimeEntry } from '#/data/types'
import { diffDays } from './dates'
import { toMinutes } from './entries'

export type TaskDay = {
  date: string
  minutes: number
  sessions: number
}

/** Coś, co wcisnęło się między dwie sesje zadania tego samego dnia. */
export type Interrupter = {
  title: string
  taskTypeId: string
  minutes: number
  /** W ilu przerwach zadania się pojawiło. */
  times: number
}

/** Przerwa w zadaniu: koniec jednej sesji, start kolejnej tego samego dnia, i co było pomiędzy. */
export type TaskGap = {
  date: string
  from: string
  to: string
  minutes: number
  between: Array<
    Pick<TimeEntry, 'id' | 'title' | 'taskTypeId'> & { minutes: number }
  >
}

export type TaskInsights = {
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

const interval = (e: Pick<TimeEntry, 'startTime' | 'endTime'>) =>
  e.startTime && e.endTime
    ? { start: toMinutes(e.startTime), end: toMinutes(e.endTime) }
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
  const ids = new Set(sessions.map((s) => s.id))
  const sorted = [...sessions].sort((a, b) =>
    (a.workDate + (a.startTime ?? '99:99')).localeCompare(
      b.workDate + (b.startTime ?? '99:99'),
    ),
  )
  const durations = sorted.map((s) => s.durationMinutes)
  const minutes = durations.reduce((a, b) => a + b, 0)

  const byDate = new Map<string, Array<TimeEntry>>()
  for (const s of sorted)
    byDate.set(s.workDate, [...(byDate.get(s.workDate) ?? []), s])
  const days = [...byDate.entries()].map(([date, list]) => ({
    date,
    minutes: list.reduce((sum, s) => sum + s.durationMinutes, 0),
    sessions: list.length,
  }))

  const gaps: Array<TaskGap> = []
  for (const [date, list] of byDate) {
    const timed = list
      .map((s) => ({ s, at: interval(s) }))
      .filter((x) => x.at !== null)
      .sort((a, b) => a.at!.start - b.at!.start)
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1]!.at!
      const next = timed[i]!.at!
      if (next.start <= prev.end) continue
      const between = sameDays
        .filter((e) => e.workDate === date && !ids.has(e.id))
        .flatMap((e) => {
          const at = interval(e)
          if (!at) return []
          const overlap =
            Math.min(at.end, next.start) - Math.max(at.start, prev.end)
          return overlap > 0
            ? [
                {
                  id: e.id,
                  title: e.title,
                  taskTypeId: e.taskTypeId,
                  minutes: overlap,
                },
              ]
            : []
        })
      gaps.push({
        date,
        from: timed[i - 1]!.s.endTime!,
        to: timed[i]!.s.startTime!,
        minutes: next.start - prev.end,
        between,
      })
    }
  }

  const interrupters = new Map<string, Interrupter>()
  for (const gap of gaps)
    for (const e of gap.between) {
      const key = `${e.taskTypeId}|${e.title}`
      const known = interrupters.get(key)
      if (known) {
        known.minutes += e.minutes
        known.times++
      } else
        interrupters.set(key, {
          title: e.title,
          taskTypeId: e.taskTypeId,
          minutes: e.minutes,
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
      (a, b) => b.minutes - a.minutes,
    ),
    overtimeMinutes: sorted.reduce((s, e) => s + (e.overtimeMinutes ?? 0), 0),
    extensionMinutes: sorted.reduce((s, e) => s + (e.extensionMinutes ?? 0), 0),
  }
}
