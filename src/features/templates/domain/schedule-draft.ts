import type { TemplateSchedule } from '#/features/templates/data/dto'
import { sameTime } from '#/features/templates/domain/schedule'

/** Formularz harmonogramu: włączony?, dni, jedna godzina albo osobna na każdy dzień. */
export interface ScheduleDraft {
  enabled: boolean
  days: Array<number>
  mode: 'same' | 'each'
  time: string
  times: Partial<Record<number, string>>
}

const DEFAULT_TIME = '09:30'

export function scheduleDraft(schedule: TemplateSchedule): ScheduleDraft {
  const shared = schedule.length > 0 ? sameTime(schedule) : DEFAULT_TIME
  return {
    enabled: schedule.length > 0,
    days: schedule.length > 0 ? schedule.map((s) => s.day) : [1, 2, 3, 4, 5],
    mode: shared === null ? 'each' : 'same',
    time: shared ?? schedule[0]?.time ?? DEFAULT_TIME,
    times: Object.fromEntries(schedule.map((s) => [s.day, s.time])),
  }
}

export function scheduleFromDraft(d: ScheduleDraft): TemplateSchedule {
  if (!d.enabled) return []
  return [...d.days]
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      time: d.mode === 'same' ? d.time : (d.times[day] ?? d.time),
    }))
}

export interface ScheduleErrorMessages {
  daysError: string
  timeError: string
}

export function scheduleErrors(d: ScheduleDraft, t: ScheduleErrorMessages) {
  if (!d.enabled) return { days: null, time: null, dayTimes: {} }
  const ok = (v: string | undefined) => !!v && /^\d{2}:\d{2}$/.test(v)
  const dayTimes: Partial<Record<number, string>> =
    d.mode === 'each'
      ? Object.fromEntries(
          d.days
            .filter((day) => !ok(d.times[day] ?? d.time))
            .map((day) => [day, t.timeError]),
        )
      : {}
  return {
    days: d.days.length === 0 ? t.daysError : null,
    time: d.mode === 'same' && !ok(d.time) ? t.timeError : null,
    dayTimes,
  }
}
