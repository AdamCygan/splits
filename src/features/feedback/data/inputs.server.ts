import { z } from 'zod'
import { trimmed } from '#/server/http/inputs'
import {
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE,
  FEEDBACK_REPLY_MAX,
  FEEDBACK_STATUSES,
} from '../domain/feedback'

export const feedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: trimmed(FEEDBACK_MESSAGE.min, FEEDBACK_MESSAGE.max),
  page: z.string().max(2000).nullable().default(null),
  userAgent: z.string().max(1000).nullable().default(null),
})

export const adminFeedbackFilterInput = z.object({
  status: z.enum([...FEEDBACK_STATUSES, 'open']).optional(),
  kind: z.enum(FEEDBACK_KINDS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const adminFeedbackChangeInput = z
  .object({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    reply: trimmed(1, FEEDBACK_REPLY_MAX).nullable().optional(),
    note: trimmed(1, 2000).nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0)
