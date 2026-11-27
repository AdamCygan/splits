import { day } from '#/server/http/inputs'
import { z } from 'zod'

export const dayOffInput = z.object({
  from: day,
  to: day,
  kind: z.enum(['vacation', 'sick', 'holiday', 'other']),
  note: z.string().max(200).nullable().default(null),
})
