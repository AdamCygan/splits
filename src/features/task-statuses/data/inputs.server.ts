import { LIMITS } from '#/features/task-types/domain/rules'
import { color, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const statusInput = z.object({
  name: trimmed(1, LIMITS.statusName),
  category: z.enum(['todo', 'in_progress', 'done']),
  color,
})
