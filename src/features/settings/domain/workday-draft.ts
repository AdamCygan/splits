import type { UserSettings } from '#/features/settings/data/dto'

/** Lista stref IANA z przeglądarki; na starszych silnikach przynajmniej bieżąca i UTC. */
export function timeZones(current: string) {
  // Starsze przeglądarki (Safari < 15.4) nie mają supportedValuesOf.
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: string) => Array<string>
  }
  const list = intl.supportedValuesOf?.('timeZone') ?? []
  return [...new Set(['UTC', current, ...list])].sort()
}

/** Dzienny limit przerw do wyboru (minuty); 0 = bez limitu. */
export const BREAK_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120]

export type Draft = UserSettings & {
  targetHours: string
  reminderOn: boolean
  reminderTime: string
}

export const toDraft = (s: UserSettings): Draft => ({
  ...s,
  targetHours: String(s.workdayTargetMinutes / 60),
  reminderOn: s.dailyReminderAt !== null,
  reminderTime: s.dailyReminderAt ?? '17:00',
})
