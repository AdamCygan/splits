import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'

/** Kontrakt API (task-statuses): typy DTO i schematy Zod sprawdzające odpowiedzi serwera. */

export type StatusCategory = 'todo' | 'in_progress' | 'done'

export interface TaskStatus {
  id: string
  name: string
  category: StatusCategory
  color: string
  isSystem: boolean
  isDefault: boolean
  sortOrder: number
  archivedAt: string | null
}

export type TaskStatusInput = Pick<TaskStatus, 'name' | 'category' | 'color'>

export const statusSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: z.enum(['todo', 'in_progress', 'done']),
  color: z.string(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  archivedAt: z.string().nullable(),
})
