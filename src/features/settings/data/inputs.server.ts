import { LIMITS, ROUNDING_OPTIONS } from '#/features/task-types/domain/rules'
import { SUMMARY_TEMPLATE_MAX } from '#/features/tasks/domain/summary'
import { locale, time, timezone } from '#/server/http/inputs'
import { z } from 'zod'

export const settingsInput = z.object({
  workdayTargetMinutes: z
    .number()
    .int()
    .min(LIMITS.workdayMinutes.min)
    .max(LIMITS.workdayMinutes.max),
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  weekStartsOn: z.number().int().min(0).max(6),
  timeRoundingMinutes: z.union(ROUNDING_OPTIONS.map((v) => z.literal(v))),
  timezone,
  locale,
  dailyReminderAt: time.nullable(),
  summaryTemplate: z.string().max(SUMMARY_TEMPLATE_MAX).nullable(),
  // Starsze klienty nie wysyłają limitu przerw: zostaje domyślne 30 minut.
  breakMinutes: z.number().int().min(0).max(240).default(30),
})
