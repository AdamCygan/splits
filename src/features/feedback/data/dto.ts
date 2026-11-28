import { planSchema } from '#/features/auth/data/dto'
import { z } from '#/lib/zod'
import { idSchema } from '#/shared/data/dto'
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from '../domain/feedback'
import type { FeedbackKind, FeedbackStatus } from '../domain/feedback'

/** Kontrakt API (feedback): zgłoszenia z aplikacji i skrzynka administratora. */
export const feedbackSchema = z.object({
  id: idSchema,
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string(),
  page: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  reply: z.string().nullable(),
  repliedAt: z.string().nullable(),
  createdAt: z.string(),
})

export type Feedback = z.infer<typeof feedbackSchema>

export const adminFeedbackSchema = feedbackSchema.extend({
  userAgent: z.string().nullable(),
  note: z.string().nullable(),
  updatedAt: z.string(),
  user: z.object({
    id: idSchema,
    email: z.string(),
    displayName: z.string(),
    plan: planSchema,
  }),
})

export type AdminFeedback = z.infer<typeof adminFeedbackSchema>

export const adminFeedbackPageSchema = z.object({
  items: z.array(adminFeedbackSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  /** Liczniki dla zakładek i plakietki w menu admina. */
  open: z.object({ new: z.number(), inProgress: z.number() }),
})

export type AdminFeedbackPage = z.infer<typeof adminFeedbackPageSchema>

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  /** Ścieżka strony (bez parametrów) i przeglądarka, gdy użytkownik się zgodził. */
  page: string | null
  userAgent: string | null
}

/** Filtry skrzynki zgłoszeń (w adresie strony i w API). */
export interface AdminFeedbackFilter {
  status?: FeedbackStatus | 'open'
  kind?: FeedbackKind
  page?: number
}

export interface AdminFeedbackChange {
  status?: FeedbackStatus
  /** Odpowiedź widoczna dla użytkownika (wysyłana mailem); null usuwa. */
  reply?: string | null
  /** Notatka tylko dla administratorów. */
  note?: string | null
}
