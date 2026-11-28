import type { UserSettings } from '#/features/settings/data/dto'
import type { Locale } from '#/i18n/config'
import type * as schema from '#/server/db/schema'

/** Ustawienia widziane przez aplikację: konta (język, strefa…) i dnia pracy w bieżącej przestrzeni. */
export const toSettings = (
  userSettingRow: typeof schema.userSettings.$inferSelect,
  workspaceSettingRow: typeof schema.workspaceSettings.$inferSelect,
): UserSettings => ({
  workdayTargetMinutes: workspaceSettingRow.workdayTargetMinutes,
  workingDays: [...workspaceSettingRow.workingDays].sort(
    (left, right) => left - right,
  ),
  weekStartsOn: userSettingRow.weekStartsOn,
  timeRoundingMinutes:
    workspaceSettingRow.timeRoundingMinutes as UserSettings['timeRoundingMinutes'],
  timezone: userSettingRow.timezone,
  locale: userSettingRow.locale as Locale,
  dailyReminderAt: userSettingRow.dailyReminderAt,
  summaryTemplate: workspaceSettingRow.summaryTemplate,
  breakMinutes: workspaceSettingRow.breakMinutes,
})
