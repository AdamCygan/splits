import type * as t from '#/server/db/schema'
import type { FeedbackKind, FeedbackStatus } from '../domain/feedback'
import type { AdminFeedback, Feedback } from './dto'

type Row = typeof t.feedback.$inferSelect
type UserRow = typeof t.users.$inferSelect

export const toFeedback = (row: Row): Feedback => ({
  id: row.id,
  kind: row.kind as FeedbackKind,
  message: row.message,
  page: row.page,
  status: row.status as FeedbackStatus,
  reply: row.reply,
  repliedAt: row.repliedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
})

export const toAdminFeedback = (
  row: Row,
  user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'plan'>,
): AdminFeedback => ({
  ...toFeedback(row),
  userAgent: row.userAgent,
  note: row.note,
  updatedAt: row.updatedAt.toISOString(),
  user: {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.plan,
  },
})
