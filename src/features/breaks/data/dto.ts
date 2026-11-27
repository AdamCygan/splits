import { z } from '#/lib/zod'

/** Kontrakt API (breaks): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

/** Przerwa w pracy: nie jest czasem pracy, liczy się względem dziennego limitu. */
export interface WorkBreak {
  id: string
  workDate: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  running: boolean
  startedAt: string | null
  /** Zadanie wstrzymane na czas przerwy. */
  resumeEntryId: string | null
}

export interface WorkBreakInput {
  workDate: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
}

export const workBreakSchema = z.object({
  id: z.string(),
  workDate: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  durationMinutes: z.number().int(),
  running: z.boolean(),
  startedAt: z.string().nullable(),
  resumeEntryId: z.string().nullable(),
})
