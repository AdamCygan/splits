import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { z } from 'zod'
import { localeOf, notify } from '#/features/account/data/notifications.server'
import { log } from '#/features/admin/data/shared.server'
import type { UserRow } from '#/features/admin/data/shared.server'
import { database } from '#/server/db/client'
import { feedback, users } from '#/server/db/schema'
import { accountEmail, sendEmail } from '#/server/email'
import { serverEnv } from '#/server/env'
import { notFound } from '#/server/http/errors'
import { feedbackPage, feedbackUserAgent } from '../domain/feedback'
import type {
  adminFeedbackChangeInput,
  adminFeedbackFilterInput,
  feedbackInput,
} from './inputs.server'
import { toAdminFeedback, toFeedback } from './mappers.server'

export type FeedbackBody = z.infer<typeof feedbackInput>
export type AdminFeedbackFilterBody = z.infer<typeof adminFeedbackFilterInput>
export type AdminFeedbackChangeBody = z.infer<typeof adminFeedbackChangeInput>

const PAGE_SIZE = 25

/** Nowe zgłoszenie użytkownika; właściciele aplikacji (ADMIN_EMAILS) dostają powiadomienie. */
export async function createFeedback(userId: string, input: FeedbackBody) {
  const [row] = await database
    .insert(feedback)
    .values({
      userId,
      kind: input.kind,
      message: input.message,
      page: input.page ? feedbackPage(input.page) : null,
      userAgent: input.userAgent ? feedbackUserAgent(input.userAgent) : null,
    })
    .returning()
  await notifyOwners(userId, row!).catch((error: unknown) =>
    console.error('[feedback] owner notification failed', error),
  )
  return toFeedback(row!)
}

async function notifyOwners(userId: string, row: typeof feedback.$inferSelect) {
  const owners = [...serverEnv.adminEmails]
  const hasNoOwners = owners.length === 0
  if (hasNoOwners) return
  const [author] = await database
    .select({ email: users.email, plan: users.plan, isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, userId))
  // Konta demo to anonimowi goście: ich zgłoszenia widać w panelu, ale bez maili.
  const isAnonymousOrDemo = !author || author.isDemo
  if (isAnonymousOrDemo) return
  const ownerLocales = await database
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(sql`lower(${users.email})`, owners))
  await Promise.all(
    owners.map(async (to) => {
      const owner = ownerLocales.find(
        (candidate) => candidate.email.toLowerCase() === to,
      )
      const locale = owner ? await localeOf(owner.id) : 'en'
      await sendEmail(
        accountEmail('feedbackNew', locale, to, {
          email: author.email,
          plan: author.plan,
          kind: row.kind,
          page: row.page ?? '—',
          message: row.message,
          link: `${serverEnv.appUrl}/app/admin/feedback`,
        }),
      )
    }),
  )
}

/** Moje zgłoszenia, od najnowszych. */
export async function listMyFeedback(userId: string) {
  const rows = await database
    .select()
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt))
    .limit(100)
  return rows.map(toFeedback)
}

const filterWhere = (filter: AdminFeedbackFilterBody): SQL | undefined =>
  and(
    filter.status === 'open'
      ? inArray(feedback.status, ['new', 'in_progress'])
      : filter.status
        ? eq(feedback.status, filter.status)
        : undefined,
    filter.kind ? eq(feedback.kind, filter.kind) : undefined,
  )

/** Skrzynka zgłoszeń (admin): filtry, stronicowanie i liczniki otwartych. */
export async function listFeedback(filter: AdminFeedbackFilterBody) {
  const where = filterWhere(filter)
  const [[total], rows, [open]] = await Promise.all([
    database.select({ n: count() }).from(feedback).where(where),
    database
      .select({ row: feedback, user: users })
      .from(feedback)
      .innerJoin(users, eq(users.id, feedback.userId))
      .where(where)
      .orderBy(desc(feedback.createdAt))
      .limit(PAGE_SIZE)
      .offset((filter.page - 1) * PAGE_SIZE),
    database
      .select({
        new: sql<number>`count(*) filter (where ${feedback.status} = 'new')::int`,
        inProgress: sql<number>`count(*) filter (where ${feedback.status} = 'in_progress')::int`,
      })
      .from(feedback),
  ])
  return {
    items: rows.map(({ row, user }) => toAdminFeedback(row, user)),
    total: total?.n ?? 0,
    page: filter.page,
    pageSize: PAGE_SIZE,
    open: { new: open?.new ?? 0, inProgress: open?.inProgress ?? 0 },
  }
}

/**
 * Zmiana stanu, odpowiedź albo notatka (admin). Nowa odpowiedź idzie do użytkownika mailem;
 * każda zmiana trafia do dziennika działań.
 */
export async function updateFeedback(
  admin: UserRow,
  id: string,
  change: AdminFeedbackChangeBody,
) {
  const { row, user, replied } = await database.transaction(
    async (transaction) => {
      const [found] = await transaction
        .select({ row: feedback, user: users })
        .from(feedback)
        .innerJoin(users, eq(users.id, feedback.userId))
        .where(eq(feedback.id, id))
      if (!found) throw notFound()
      const replyChanged =
        change.reply !== undefined && change.reply !== found.row.reply
      const [updated] = await transaction
        .update(feedback)
        .set({
          ...(change.status ? { status: change.status } : {}),
          ...(change.note !== undefined ? { note: change.note } : {}),
          ...(replyChanged
            ? {
                reply: change.reply,
                repliedAt: change.reply ? new Date() : null,
              }
            : {}),
        })
        .where(eq(feedback.id, id))
        .returning()
      const changesStatus = change.status && change.status !== found.row.status
      if (changesStatus)
        await log(
          transaction,
          admin,
          found.user,
          'feedback.updated',
          change.status,
        )
      const sendsReply = replyChanged && change.reply
      if (sendsReply)
        await log(transaction, admin, found.user, 'feedback.replied')
      return {
        row: updated!,
        user: found.user,
        replied: replyChanged && Boolean(change.reply),
      }
    },
  )
  if (replied)
    await notify(user, 'feedbackReply', {
      message: row.message.slice(0, 500),
      reply: row.reply ?? '',
      link: `${serverEnv.appUrl}/app/settings/help`,
    }).catch((error: unknown) =>
      console.error('[feedback] reply e-mail failed', error),
    )
  return toAdminFeedback(row, user)
}
