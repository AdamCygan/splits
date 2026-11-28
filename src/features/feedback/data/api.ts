import {
  adminFeedbackPageSchema,
  adminFeedbackSchema,
  feedbackSchema,
} from './dto'
import type {
  AdminFeedback,
  AdminFeedbackChange,
  AdminFeedbackFilter,
  AdminFeedbackPage,
  Feedback,
  FeedbackInput,
} from './dto'
import { z } from '#/lib/zod'
import { get, queryString, send } from '#/shared/data/http'
import type { R } from '#/shared/data/http'

/** Zgłoszenia „Zgłoś problem / pomysł” i skrzynka zgłoszeń w panelu admina. */
export interface FeedbackApi {
  send: (input: FeedbackInput) => R<Feedback>
  /** Moje zgłoszenia, od najnowszych (ze stanem i odpowiedzią). */
  mine: () => R<Array<Feedback>>
  admin: {
    list: (filter: AdminFeedbackFilter) => R<AdminFeedbackPage>
    update: (id: string, change: AdminFeedbackChange) => R<AdminFeedback>
  }
}

/** Wywołania API (/api/v1) tej funkcji; kształt odpowiedzi sprawdzają schematy z dto.ts. */
export const feedbackApi: FeedbackApi = {
  send: (input) => send('POST', '/feedback', feedbackSchema, input),
  mine: () => get('/feedback', z.array(feedbackSchema)),
  admin: {
    list: (filter) =>
      get(
        `/admin/feedback${queryString({ ...filter })}`,
        adminFeedbackPageSchema,
      ),
    update: (id, change) =>
      send('PATCH', `/admin/feedback/${id}`, adminFeedbackSchema, change),
  },
}
