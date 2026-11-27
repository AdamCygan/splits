import type { Locale } from '#/i18n/config'
import { z } from '#/lib/zod'

/** Kontrakt API (settings): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export type TimeInputMode = 'range' | 'duration'

export type RoundingMinutes = 0 | 1 | 5 | 10 | 15 | 30

export interface UserSettings {
  workdayTargetMinutes: number
  /** 0 = niedziela … 6 = sobota (jak .NET DayOfWeek). */
  workingDays: Array<number>
  weekStartsOn: number
  timeRoundingMinutes: RoundingMinutes
  timezone: string
  locale: Locale
  /** 'HH:MM' albo null = przypomnienie wyłączone. */
  dailyReminderAt: string | null
  /** Własny szablon podsumowania zadania; null = domyślny w języku użytkownika. */
  summaryTemplate: string | null
  /** Ile minut przerwy dziennie przysługuje; 0 = bez limitu. */
  breakMinutes: number
}

export const settingsSchema = z.object({
  workdayTargetMinutes: z.number().int(),
  workingDays: z.array(z.number().int().min(0).max(6)),
  weekStartsOn: z.number().int().min(0).max(6),
  timeRoundingMinutes: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(30),
  ]),
  timezone: z.string(),
  summaryTemplate: z.string().nullable().default(null),
  breakMinutes: z.number().int().default(30),
  locale: z.enum(['en', 'pl']),
  dailyReminderAt: z.string().nullable(),
})
