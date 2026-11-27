import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (story-points): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface SpScaleStep {
  id: string
  points: number
  maxMinutes: number
}

export const scaleSchema = z.array(
  z.object({ id: idSchema, points: z.number(), maxMinutes: z.number().int() }),
)
