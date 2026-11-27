import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (projects): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export interface Project {
  id: string
  name: string
  key: string | null
  color: string
  archivedAt: string | null
}

export type ProjectInput = Pick<Project, 'name' | 'key' | 'color'>

export const projectSchema = z.object({
  id: idSchema,
  name: z.string(),
  key: z.string().nullable(),
  color: z.string(),
  archivedAt: z.string().nullable(),
})
