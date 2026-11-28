import type { UserSettings } from '#/features/settings/data/dto'
import type { Locale } from '#/i18n/config'
import type * as t from '#/server/db/schema'

/** Ustawienia widziane przez aplikację: konta (język, strefa…) i dnia pracy w bieżącej przestrzeni. */
export const toSettings = (
  s: typeof t.userSettings.$inferSelect,
  w: typeof t.workspaceSettings.$inferSelect,
): UserSettings => ({
  workdayTargetMinutes: w.workdayTargetMinutes,
  workingDays: [...w.workingDays].sort((a, b) => a - b),
  weekStartsOn: s.weekStartsOn,
  timeRoundingMinutes:
    w.timeRoundingMinutes as UserSettings['timeRoundingMinutes'],
  timezone: s.timezone,
  locale: s.locale as Locale,
  dailyReminderAt: s.dailyReminderAt,
  summaryTemplate: w.summaryTemplate,
  breakMinutes: w.breakMinutes,
})
