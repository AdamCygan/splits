import { day, time } from '#/server/http/inputs'
import { z } from 'zod'

export const breakInput = z.object({
  workDate: day,
  startTime: time.nullable(),
  endTime: time.nullable(),
  durationMinutes: z.number().int().min(1).max(1440),
})

export const breakEndInput = z.object({ resume: z.boolean().default(true) })
