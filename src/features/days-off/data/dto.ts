import { z } from '#/lib/zod'

/** Kontrakt API (days-off): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

/** Rodzaj dnia wolnego: urlop, zwolnienie lekarskie (L4), święto, inne wolne. */
export type DayOffKind = 'vacation' | 'sick' | 'holiday' | 'other'

export const DAY_OFF_KINDS: ReadonlyArray<DayOffKind> = [
  'vacation',
  'sick',
  'holiday',
  'other',
]

export interface DayOff {
  date: string
  kind: DayOffKind
  note: string | null
}

/** Zakres dni wolnych: dni pracy z ustawień w tym zakresie dostają ten sam rodzaj. */
export interface DayOffInput {
  from: string
  to: string
  kind: DayOffKind
  note: string | null
}

export const dayOffSchema = z.object({
  date: z.string(),
  kind: z.enum(['vacation', 'sick', 'holiday', 'other']),
  note: z.string().nullable(),
})
