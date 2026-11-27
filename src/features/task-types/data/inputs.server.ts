import { LIMITS } from '#/features/task-types/domain/rules'
import { color, requirement, sp, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const taskTypeInput = z.object({
  name: trimmed(1, LIMITS.taskTypeName),
  color,
  titleLabel: trimmed(1, LIMITS.linkLabel),
  linkRequirement: requirement,
  linkLabel: z.string().trim().max(LIMITS.linkLabel),
  descriptionRequirement: requirement,
  storyPointsRequirement: requirement,
  defaultStoryPoints: sp.nullable(),
  defaultTimeInput: z.enum(['range', 'duration']),
  countsAsFocusWork: z.boolean(),
})
