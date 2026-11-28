import type { UserSettings } from '#/features/settings/data/dto'

/** Lista stref IANA z przeglądarki; na starszych silnikach przynajmniej bieżąca i UTC. */
export function timeZones(current: string) {
  // Starsze przeglądarki (Safari < 15.4) nie mają supportedValuesOf.
  const formatter = Intl as unknown as {
    supportedValuesOf?: (key: string) => Array<string>
  }
  const list = formatter.supportedValuesOf?.('timeZone') ?? []
  return [...new Set(['UTC', current, ...list])].sort()
}

/** Dzienny limit przerw do wyboru (minuty); 0 = bez limitu. */
export const BREAK_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90, 120]

export type Draft = UserSettings & {
  targetHours: string
  reminderOn: boolean
  reminderTime: string
}

export const toDraft = (userSettings: UserSettings): Draft => ({
  ...userSettings,
  targetHours: String(userSettings.workdayTargetMinutes / 60),
  reminderOn: userSettings.dailyReminderAt !== null,
  reminderTime: userSettings.dailyReminderAt ?? '17:00',
})
