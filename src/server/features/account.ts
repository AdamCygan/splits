import { and, asc, eq, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { cutAccess } from '../auth/access'
import { hashPassword, verifyPassword } from '../auth/passwords'
import { REFRESH_COOKIE, revokeOtherSessions } from '../auth/tokens'
import { db } from '../db/client'
import * as t from '../db/schema'
import { users } from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, conflict } from '../http/errors'
import {
  body,
  deleteAccountInput,
  passwordChangeInput,
  profileInput,
} from '../http/inputs'
import { rateLimit } from '../http/rate-limit'
import { billingEnabled } from '../billing/stripe'
import { clearRefreshCookie } from './auth'
import { cancelSubscriptionsFor } from './billing'
import { toUser } from './dto'

export async function currentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user) throw new ApiError('auth.no_session', 401)
  return user
}

export interface DemoFlag {
  isDemo: boolean
}

/** Konto demo jest tylko do oglądania aplikacji: bez zmian danych konta i bez płatności. */
export function assertNotDemo(user: DemoFlag) {
  if (user.isDemo) throw new ApiError('demo.restricted', 403)
}

export const accountRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(toUser(await currentUser(c.get('userId')))))

  /**
   * Eksport wszystkich danych konta do pliku JSON (prawo do przenoszenia danych, RODO art. 20).
   * Bez haseł, tokenów i identyfikatorów Stripe.
   */
  .get('/export', async (c) => {
    const userId = c.get('userId')
    rateLimit(`export:${userId}`, 10, 60 * 60_000)
    const user = await currentUser(userId)
    const own = <T extends { userId: unknown }>(rows: Array<T>) =>
      rows.map(({ userId: _owner, ...rest }) => rest)
    const [
      settings,
      scale,
      types,
      statuses,
      cadence,
      sprints,
      projects,
      tags,
      templates,
      entries,
      subs,
      daysOff,
      breaks,
    ] = await Promise.all([
      db.select().from(t.userSettings).where(eq(t.userSettings.userId, userId)),
      db
        .select()
        .from(t.storyPointScale)
        .where(eq(t.storyPointScale.userId, userId)),
      db.select().from(t.taskTypes).where(eq(t.taskTypes.userId, userId)),
      db.select().from(t.taskStatuses).where(eq(t.taskStatuses.userId, userId)),
      db
        .select()
        .from(t.sprintCadences)
        .where(eq(t.sprintCadences.userId, userId)),
      db
        .select()
        .from(t.sprints)
        .where(eq(t.sprints.userId, userId))
        .orderBy(asc(t.sprints.startsOn)),
      db.select().from(t.projects).where(eq(t.projects.userId, userId)),
      db.select().from(t.tags).where(eq(t.tags.userId, userId)),
      db
        .select()
        .from(t.quickTemplates)
        .where(eq(t.quickTemplates.userId, userId)),
      db
        .select()
        .from(t.timeEntries)
        .where(eq(t.timeEntries.userId, userId))
        .orderBy(asc(t.timeEntries.workDate), asc(t.timeEntries.createdAt)),
      db
        .select({
          status: t.subscriptions.status,
          plan: t.subscriptions.plan,
          currentPeriodEnd: t.subscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: t.subscriptions.cancelAtPeriodEnd,
          createdAt: t.subscriptions.createdAt,
        })
        .from(t.subscriptions)
        .where(eq(t.subscriptions.userId, userId)),
      db
        .select()
        .from(t.daysOff)
        .where(eq(t.daysOff.userId, userId))
        .orderBy(asc(t.daysOff.date)),
      db
        .select()
        .from(t.breaks)
        .where(eq(t.breaks.userId, userId))
        .orderBy(asc(t.breaks.workDate), asc(t.breaks.createdAt)),
    ])
    c.header(
      'Content-Disposition',
      `attachment; filename="pointhours-export-${new Date().toISOString().slice(0, 10)}.json"`,
    )
    return c.json({
      format: 'splits-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        plan: user.plan,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      settings: own(settings)[0] ?? null,
      storyPointScale: own(scale),
      taskTypes: own(types),
      taskStatuses: own(statuses),
      sprintCadence: own(cadence)[0] ?? null,
      sprints: own(sprints),
      projects: own(projects),
      tags: own(tags),
      quickTemplates: own(templates),
      timeEntries: own(entries),
      daysOff: own(daysOff),
      breaks: own(breaks),
      subscriptions: subs,
    })
  })

  .put('/profile', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, profileInput)
    assertNotDemo(await currentUser(userId))
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(sql`lower(${users.email})`, input.email.trim().toLowerCase()),
          ne(users.id, userId),
        ),
      )
    if (taken) throw conflict('auth.email_taken', 'email')
    const [user] = await db
      .update(users)
      .set({ displayName: input.displayName, email: input.email.trim() })
      .where(eq(users.id, userId))
      .returning()
    return c.json(toUser(user!))
  })

  .post('/password', async (c) => {
    const userId = c.get('userId')
    rateLimit(`password:${userId}`, 10, 15 * 60_000)
    const input = await body(c, passwordChangeInput)
    const user = await currentUser(userId)
    assertNotDemo(user)
    // Konto założone przez Google nie ma hasła: pierwsze hasło ustawia się bez obecnego.
    if (
      user.passwordHash &&
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    )
      throw new ApiError('auth.wrong_password', 400, 'currentPassword')
    const passwordHash = await hashPassword(input.newPassword)
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: new Date() })
        .where(eq(users.id, userId))
      await revokeOtherSessions(tx, userId, getCookie(c, REFRESH_COOKIE))
    })
    return c.body(null, 204)
  })

  .delete('/', async (c) => {
    const userId = c.get('userId')
    rateLimit(`delete:${userId}`, 10, 15 * 60_000)
    const input = await body(c, deleteAccountInput)
    const user = await currentUser(userId)
    if (
      user.passwordHash &&
      !(await verifyPassword(input.password, user.passwordHash))
    )
      throw new ApiError('auth.wrong_password', 400, 'password')
    // Najpierw koniec płatności, potem ON DELETE CASCADE usuwa wszystkie dane konta.
    if (billingEnabled()) await cancelSubscriptionsFor(userId)
    await db.delete(users).where(eq(users.id, userId))
    cutAccess(userId)
    clearRefreshCookie(c)
    return c.body(null, 204)
  })
