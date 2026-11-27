import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (tags): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface Tag {
  id: string
  name: string
  color: string
}

export type TagInput = Pick<Tag, 'name' | 'color'>

export const tagSchema = z.object({
  id: idSchema,
  name: z.string(),
  color: z.string(),
})
