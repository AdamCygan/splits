import { z } from 'zod'

export const scaleInput = z.object({
  steps: z
    .array(z.object({ points: z.number(), maxMinutes: z.number().int() }))
    .max(50),
})
