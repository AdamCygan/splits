import type {
  QuickTemplate,
  TemplateSchedule,
} from '#/features/templates/data/dto'
import type { TimeEntry } from '#/features/time-entries/data/dto'
import { weekday } from './dates'
import { fromMinutes, toMinutes } from './entries'

export interface ScheduledMeeting {
  template: QuickTemplate
  start: string
  end: string
}

/**
 * Powtarzane szablony (np. daily) zaplanowane na `date`, od najwcześniejszego.
 * Koniec = start + czas trwania szablonu (najpóźniej 23:59).
 */
export function scheduledOn(
  templates: ReadonlyArray<QuickTemplate>,
  date: string,
): Array<ScheduledMeeting> {
  const day = weekday(date)
  return templates
    .flatMap((template) => {
      const slot = template.schedule.find((s) => s.day === day)
      if (!slot || template.defaultDurationMinutes === null) return []
      const end = Math.min(
        toMinutes(slot.time) + template.defaultDurationMinutes,
        23 * 60 + 59,
      )
      return [{ template, start: slot.time, end: fromMinutes(end) }]
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}

/** Czy spotkanie z szablonu jest już wpisane tego dnia (ten sam typ i tytuł). */
export function isLogged(
  entries: ReadonlyArray<Pick<TimeEntry, 'taskTypeId' | 'title'>>,
  template: Pick<QuickTemplate, 'taskTypeId' | 'title'>,
) {
  const title = template.title.trim().toLocaleLowerCase()
  return entries.some(
    (e) =>
      e.taskTypeId === template.taskTypeId &&
      e.title.trim().toLocaleLowerCase() === title,
  )
}

/** Godzina wspólna dla wszystkich dni harmonogramu; null = dni mają różne godziny. */
export function sameTime(schedule: TemplateSchedule): string | null {
  const times = new Set(schedule.map((s) => s.time))
  return times.size === 1 ? schedule[0]!.time : null
}

/**
 * Harmonogram do krótkiego opisu: kolejne dni tygodnia (od `weekStartsOn`) z tą samą
 * godziną łączą się w jeden przedział, np. pn 10:00, wt–pt 9:30.
 */
export function scheduleRuns(
  schedule: TemplateSchedule,
  weekStartsOn: number,
): Array<{ from: number; to: number; time: string }> {
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7)
  const byDay = new Map(schedule.map((s) => [s.day, s.time]))
  const runs: Array<{ from: number; to: number; time: string }> = []
  let previous: number | null = null
  for (const day of order) {
    const time = byDay.get(day)
    const last = runs.at(-1)
    if (time === undefined) {
      previous = null
      continue
    }
    if (last && previous === last.to && last.time === time) last.to = day
    else runs.push({ from: day, to: day, time })
    previous = day
  }
  return runs
}
