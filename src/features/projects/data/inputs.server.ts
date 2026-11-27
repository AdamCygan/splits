import { LIMITS, PROJECT_KEY_RE } from '#/features/task-types/domain/rules'
import { color, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const projectInput = z.object({
  name: trimmed(1, LIMITS.projectName),
  key: z.string().regex(PROJECT_KEY_RE).nullable(),
  color,
})
