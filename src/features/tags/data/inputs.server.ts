import { LIMITS } from '#/features/task-types/domain/rules'
import { color, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const tagInput = z.object({ name: trimmed(1, LIMITS.tagName), color })
