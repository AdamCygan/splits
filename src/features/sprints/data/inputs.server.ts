import { LIMITS } from '#/features/task-types/domain/rules'
import { day, trimmed } from '#/server/http/inputs'
import { z } from 'zod'

export const cadenceInput = z.object({
  lengthDays: z
    .number()
    .int()
    .min(LIMITS.sprintLengthDays.min)
    .max(LIMITS.sprintLengthDays.max),
  anchorDate: day,
  namePattern: trimmed(1, LIMITS.sprintName),
  autoCreate: z.boolean(),
})

export const sprintInput = z.object({
  name: trimmed(1, LIMITS.sprintName),
  goal: z.string().trim().max(LIMITS.sprintGoal).nullable(),
  startsOn: day,
  endsOn: day,
  capacityStoryPoints: z.number().min(0).max(1000).nullable(),
  timeGoals: z
    .array(
      z.object({
        taskTypeId: z.string().uuid(),
        minutes: z.number().int().min(1).max(100_000),
      }),
    )
    .max(20)
    .default([])
    .refine(
      (list) => new Set(list.map((g) => g.taskTypeId)).size === list.length,
    ),
})
