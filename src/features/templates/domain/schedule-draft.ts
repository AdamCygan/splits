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
    days:
      schedule.length > 0 ? schedule.map((slot) => slot.day) : [1, 2, 3, 4, 5],
    mode: shared === null ? 'each' : 'same',
    time: shared ?? schedule[0]?.time ?? DEFAULT_TIME,
    times: Object.fromEntries(schedule.map((slot) => [slot.day, slot.time])),
  }
}

export function scheduleFromDraft(draft: ScheduleDraft): TemplateSchedule {
  if (!draft.enabled) return []
  return [...draft.days]
    .sort((left, right) => left - right)
    .map((day) => ({
      day,
      time:
        draft.mode === 'same' ? draft.time : (draft.times[day] ?? draft.time),
    }))
}

export interface ScheduleErrorMessages {
  daysError: string
  timeError: string
}

export function scheduleErrors(
  draft: ScheduleDraft,
  scheduleErrorMessages: ScheduleErrorMessages,
) {
  if (!draft.enabled) return { days: null, time: null, dayTimes: {} }
  const ok = (time: string | undefined) => !!time && /^\d{2}:\d{2}$/.test(time)
  const dayTimes: Partial<Record<number, string>> =
    draft.mode === 'each'
      ? Object.fromEntries(
          draft.days
            .filter((day) => !ok(draft.times[day] ?? draft.time))
            .map((day) => [day, scheduleErrorMessages.timeError]),
        )
      : {}
  return {
    days: draft.days.length === 0 ? scheduleErrorMessages.daysError : null,
    time:
      draft.mode === 'same' && !ok(draft.time)
        ? scheduleErrorMessages.timeError
        : null,
    dayTimes,
  }
}
