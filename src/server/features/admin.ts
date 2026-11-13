import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,
  or,
  sql,
} from 'drizzle-orm'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { planById } from '#/features/billing/plans'
import { cutAccess, restoreAccess } from '../auth/access'
import { billingEnabled } from '../billing/stripe'
import { db } from '../db/client'
import type { Tx } from '../db/client'
import {
  adminActions,
  refreshTokens,
  subscriptions,
  timeEntries,
  users,
} from '../db/schema'
import type { AppEnv } from '../http/context'
import { ApiError, invalid, notFound } from '../http/errors'
import { body, parse } from '../http/inputs'
import { isOwner } from './auth'
import { cancelSubscriptionsFor } from './billing'

/**
 * Panel administratora (/api/v1/admin). Dostęp tylko dla roli „admin”, sprawdzanej w bazie
 * przy każdym żądaniu (odebranie roli działa od razu, nie dopiero po wygaśnięciu tokenu).
 *
 * Administrator widzi dane konta i liczniki, ale nie treść wpisów czasu użytkowników.
 * Każda zmiana trafia do dziennika admin_actions.
 */
type UserRow = typeof users.$inferSelect

const PAGE_SIZE = 25
const ACTIVE_SUBSCRIPTION = ['active', 'trialing', 'past_due']
const DAY = 86_400_000

const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, c.get('userId')))
  if (!user || user.role !== 'admin' || user.disabledAt)
    throw new ApiError('auth.forbidden', 403)
  c.set('admin', user)
  await next()
}

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  plan: z.enum(['free', 'pro', 'lifetime']).optional(),
  status: z.enum(['active', 'blocked', 'demo']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

const patchInput = z
  .object({
    plan: z.enum(['free', 'pro', 'lifetime']),
    role: z.enum(['client', 'admin']),
    disabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0)

const iso = (d: Date | null) => (d ? d.toISOString() : null)
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

function log(
  tx: Tx,
  admin: UserRow,
  target: Pick<UserRow, 'id' | 'email'>,
  action: string,
  detail: string | null = null,
) {
  return tx.insert(adminActions).values({
    adminId: admin.id,
    adminEmail: admin.email,
    targetUserId: target.id,
    targetEmail: target.email,
    action,
    detail,
  })
}

/** Wiersze listy: konto + liczba wpisów i najnowsza subskrypcja (dwa zapytania na stronę, nie na wiersz). */
async function describe(rows: Array<UserRow>) {
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []
  const [entryStats, subs] = await Promise.all([
    db
      .select({
        userId: timeEntries.userId,
        entries: count(),
        lastEntryOn: max(timeEntries.workDate),
      })
      .from(timeEntries)
      .where(inArray(timeEntries.userId, ids))
      .groupBy(timeEntries.userId),
    db
      .select()
      .from(subscriptions)
      .where(inArray(subscriptions.userId, ids))
      .orderBy(desc(subscriptions.updatedAt)),
  ])
  return rows.map((u) => {
    const stats = entryStats.find((s) => s.userId === u.id)
    const sub = subs.find((s) => s.userId === u.id)
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      plan: u.plan,
      isDemo: u.isDemo,
      hasPassword: u.passwordHash !== null,
      emailVerified: u.emailVerifiedAt !== null,
      isOwner: isOwner(u),
      disabledAt: iso(u.disabledAt),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: iso(u.lastLoginAt),
      entries: stats?.entries ?? 0,
      lastEntryOn: stats?.lastEntryOn ?? null,
      subscription: sub
        ? {
            status: sub.status,
            active: ACTIVE_SUBSCRIPTION.includes(sub.status),
            currentPeriodEnd: iso(sub.currentPeriodEnd),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
    }
  })
}

async function findUser(id: string) {
  if (!z.uuid().safeParse(id).success) throw notFound()
  const [user] = await db.select().from(users).where(eq(users.id, id))
  if (!user) throw notFound()
  return user
}

const revokeSessions = (tx: Tx, userId: string) =>
  tx
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)),
    )

export const adminRoutes = new Hono<AppEnv>()
  .use('*', requireAdmin)

  /** Liczby na górze panelu: konta, plany, aktywność, przychód roczny z aktywnych subskrypcji. */
  .get('/stats', async (c) => {
    const now = Date.now()
    const real = eq(users.isDemo, false)
    const since = (days: number) => new Date(now - days * DAY)
    const [totals] = await db
      .select({
        users: count(),
        new7: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(7)})::int`,
        new30: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(30)})::int`,
        active7: sql<number>`count(*) filter (where ${users.lastLoginAt} >= ${since(7)})::int`,
        free: sql<number>`count(*) filter (where ${users.plan} = 'free')::int`,
        pro: sql<number>`count(*) filter (where ${users.plan} = 'pro')::int`,
        lifetime: sql<number>`count(*) filter (where ${users.plan} = 'lifetime')::int`,
        blocked: sql<number>`count(*) filter (where ${users.disabledAt} is not null)::int`,
      })
      .from(users)
      .where(real)
    const [demo, [subs], signups] = await Promise.all([
      db.$count(users, eq(users.isDemo, true)),
      db
        .select({
          active: count(),
          seats: sql<number>`coalesce(sum(${subscriptions.quantity}), 0)::int`,
        })
        .from(subscriptions)
        .where(inArray(subscriptions.status, ACTIVE_SUBSCRIPTION)),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
          count: count(),
        })
        .from(users)
        .where(and(real, gte(users.createdAt, since(13))))
        .groupBy(sql`1`)
        .orderBy(sql`1`),
    ])
    return c.json({
      ...totals!,
      demo,
      activeSubscriptions: subs?.active ?? 0,
      yearlyRevenue: (subs?.seats ?? 0) * (planById('pro').yearly ?? 0),
      signups,
    })
  })

  .get('/users', async (c) => {
    const query = parse(listQuery, c.req.query())
    const pattern = query.q ? `%${escapeLike(query.q)}%` : null
    const where = and(
      // Konta demo tylko po wybraniu filtra „demo”, żeby nie zaśmiecały listy klientów.
      eq(users.isDemo, query.status === 'demo'),
      query.plan ? eq(users.plan, query.plan) : undefined,
      query.status === 'blocked' ? isNotNull(users.disabledAt) : undefined,
      query.status === 'active' ? isNull(users.disabledAt) : undefined,
      pattern
        ? or(
            ilike(users.email, pattern),
            ilike(users.username, pattern),
            ilike(users.displayName, pattern),
          )
        : undefined,
    )
    const [total, rows] = await Promise.all([
      db.$count(users, where),
      db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(PAGE_SIZE)
        .offset((query.page - 1) * PAGE_SIZE),
    ])
    return c.json({
      items: await describe(rows),
      total,
      page: query.page,
      pageSize: PAGE_SIZE,
    })
  })

  .get('/users/:id', async (c) => {
    const [row] = await describe([await findUser(c.req.param('id'))])
    return c.json(row)
  })

  /** Zmiana planu, roli albo blokada. Każda zmiana osobno w dzienniku. */
  .patch('/users/:id', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    const input = await body(c, patchInput)
    const self = user.id === admin.id
    if (self && (input.role !== undefined || input.disabled !== undefined))
      throw new ApiError('admin.self', 400)
    if (user.isDemo && (input.plan !== undefined || input.role !== undefined))
      throw invalid()
    // Właściciela (ADMIN_EMAILS) nie da się zdegradować ani zablokować z panelu.
    if (isOwner(user) && (input.role === 'client' || input.disabled === true))
      throw new ApiError('admin.owner', 400)

    const updated = await db.transaction(async (tx) => {
      const set: Partial<UserRow> = {}
      if (input.plan !== undefined && input.plan !== user.plan) {
        set.plan = input.plan
        await log(
          tx,
          admin,
          user,
          'plan.changed',
          `${user.plan} → ${input.plan}`,
        )
      }
      if (input.role !== undefined && input.role !== user.role) {
        set.role = input.role
        await log(
          tx,
          admin,
          user,
          'role.changed',
          `${user.role} → ${input.role}`,
        )
      }
      if (
        input.disabled !== undefined &&
        input.disabled !== !!user.disabledAt
      ) {
        set.disabledAt = input.disabled ? new Date() : null
        if (input.disabled) await revokeSessions(tx, user.id)
        await log(
          tx,
          admin,
          user,
          input.disabled ? 'user.blocked' : 'user.unblocked',
        )
      }
      if (Object.keys(set).length === 0) return user
      const [row] = await tx
        .update(users)
        .set(set)
        .where(eq(users.id, user.id))
        .returning()
      return row!
    })
    if (input.disabled === true) cutAccess(user.id)
    if (input.disabled === false) restoreAccess(user.id)
    const [row] = await describe([updated])
    return c.json(row)
  })

  /** Wylogowanie ze wszystkich urządzeń (np. po zgłoszeniu przejęcia konta). */
  .post('/users/:id/revoke-sessions', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    await db.transaction(async (tx) => {
      await revokeSessions(tx, user.id)
      await log(tx, admin, user, 'sessions.revoked')
    })
    return c.body(null, 204)
  })

  /** Usunięcie konta z danymi: najpierw koniec subskrypcji w Stripe, potem ON DELETE CASCADE. */
  .delete('/users/:id', async (c) => {
    const admin = c.get('admin')!
    const user = await findUser(c.req.param('id'))
    if (user.id === admin.id) throw new ApiError('admin.self', 400)
    if (isOwner(user)) throw new ApiError('admin.owner', 400)
    if (billingEnabled()) await cancelSubscriptionsFor(user.id)
    await db.transaction(async (tx) => {
      await log(tx, admin, user, 'user.deleted', `plan ${user.plan}`)
      await tx.delete(users).where(eq(users.id, user.id))
    })
    cutAccess(user.id)
    return c.body(null, 204)
  })

  .get('/actions', async (c) => {
    const rows = await db
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(50)
    return c.json(
      rows.map((r) => ({
        id: r.id,
        adminEmail: r.adminEmail,
        targetEmail: r.targetEmail,
        action: r.action,
        detail: r.detail,
        createdAt: r.createdAt.toISOString(),
      })),
    )
  })
