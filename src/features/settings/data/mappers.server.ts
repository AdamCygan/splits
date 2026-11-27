import type { UserSettings } from '#/features/settings/data/dto'
import type { Locale } from '#/i18n/config'
import type * as t from '#/server/db/schema'

export const toSettings = (
  s: typeof t.userSettings.$inferSelect,
): UserSettings => ({
  workdayTargetMinutes: s.workdayTargetMinutes,
  workingDays: [...s.workingDays].sort((a, b) => a - b),
  weekStartsOn: s.weekStartsOn,
  timeRoundingMinutes:
    s.timeRoundingMinutes as UserSettings['timeRoundingMinutes'],
  timezone: s.timezone,
  locale: s.locale as Locale,
  dailyReminderAt: s.dailyReminderAt,
  summaryTemplate: s.summaryTemplate,
  breakMinutes: s.breakMinutes,
})
