import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
  or,
  sql,
} from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { z } from 'zod'
import {
  ADMIN_USER_SORTS,
  PAYMENT_PROBLEM_STATUSES,
} from '#/features/admin/domain/admin'
import { db } from '#/server/db/client'
import { subscriptions, timeEntries, users } from '#/server/db/schema'
import { iso } from '#/server/http/json'
import { isOwner } from '#/features/auth/data/repository.server'
import { ACTIVE_SUBSCRIPTION, DAY } from './shared.server'
import type { UserRow } from './shared.server'

/** Filtry i sortowanie listy kont (te same dla strony listy i eksportu CSV). */
export const userFilterInput = z.object({
  q: z.string().trim().max(100).optional(),
  plan: z.enum(['free', 'pro', 'lifetime']).optional(),
  status: z.enum(['active', 'blocked', 'demo']).optional(),
  payment: z.enum(['problem']).optional(),
  email: z.enum(['unverified']).optional(),
  twoFactor: z.enum(['on', 'off']).optional(),
  inactiveDays: z.coerce.number().int().min(1).max(3650).optional(),
  sort: z.enum(ADMIN_USER_SORTS).default('created'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

export type UserFilter = z.infer<typeof userFilterInput>

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

/** Liczniki wpisów na konto: ile, ostatni dzień pracy i ostatnie dodanie wpisu (aktywność). */
const entryStats = db
  .select({
    userId: timeEntries.userId,
    entries: count().as('entries'),
    lastEntryOn: max(timeEntries.workDate).as('last_entry_on'),
    lastActiveAt: max(timeEntries.createdAt).as('last_active_at'),
  })
  .from(timeEntries)
  .groupBy(timeEntries.userId)
  .as('entry_stats')

function whereOf(filter: UserFilter): SQL | undefined {
  const pattern = filter.q ? `%${escapeLike(filter.q)}%` : null
  const since = filter.inactiveDays
    ? new Date(Date.now() - filter.inactiveDays * DAY)
    : null
  return and(
    // Konta demo tylko po wybraniu filtra „demo”, żeby nie zaśmiecały listy klientów.
    eq(users.isDemo, filter.status === 'demo'),
    filter.plan ? eq(users.plan, filter.plan) : undefined,
    filter.status === 'blocked' ? isNotNull(users.disabledAt) : undefined,
    filter.status === 'active' ? isNull(users.disabledAt) : undefined,
    filter.email === 'unverified' ? isNull(users.emailVerifiedAt) : undefined,
    filter.twoFactor === 'on' ? isNotNull(users.totpEnabledAt) : undefined,
    filter.twoFactor === 'off' ? isNull(users.totpEnabledAt) : undefined,
    filter.payment === 'problem'
      ? inArray(
          users.id,
          db
            .select({ id: subscriptions.userId })
            .from(subscriptions)
            .where(
              inArray(subscriptions.status, [...PAYMENT_PROBLEM_STATUSES]),
            ),
        )
      : undefined,
    // Nieaktywny = konto starsze niż okres i bez nowego wpisu w tym okresie.
    since
      ? and(
          lt(users.createdAt, since),
          or(
            isNull(entryStats.lastActiveAt),
            lt(entryStats.lastActiveAt, since),
          ),
        )
      : undefined,
    pattern
      ? or(
          ilike(users.email, pattern),
          ilike(users.username, pattern),
          ilike(users.displayName, pattern),
        )
      : undefined,
  )
}

function orderOf({ sort, dir }: UserFilter): Array<SQL> {
  const column = {
    created: sql`${users.createdAt}`,
    name: sql`lower(${users.displayName})`,
    email: sql`lower(${users.email})`,
    plan: sql`${users.plan}`,
    lastLogin: sql`${users.lastLoginAt}`,
    lastActive: sql`${entryStats.lastActiveAt}`,
    entries: sql`coalesce(${entryStats.entries}, 0)`,
  }[sort]
  // Puste wartości (nigdy) zawsze na końcu; remis rozstrzyga data założenia.
  return [
    dir === 'asc'
      ? sql`${column} asc nulls last`
      : sql`${column} desc nulls last`,
    dir === 'asc' ? asc(users.createdAt) : desc(users.createdAt),
  ]
}

/** Strona listy kont (albo całość do eksportu, gdy `page` = null) z liczbą wszystkich trafień. */
export async function findUsers(
  filter: UserFilter,
  page: { size: number; number: number } | null,
) {
  const where = whereOf(filter)
  const base = db
    .select({
      user: users,
      entries: entryStats.entries,
      lastEntryOn: entryStats.lastEntryOn,
      lastActiveAt: entryStats.lastActiveAt,
    })
    .from(users)
    .leftJoin(entryStats, eq(entryStats.userId, users.id))
    .where(where)
    .orderBy(...orderOf(filter))
  const [[total], rows] = await Promise.all([
    db
      .select({ n: count() })
      .from(users)
      .leftJoin(entryStats, eq(entryStats.userId, users.id))
      .where(where),
    page
      ? base.limit(page.size).offset((page.number - 1) * page.size)
      : base.limit(10_000),
  ])
  return {
    total: total?.n ?? 0,
    items: await describe(rows.map(({ user, ...stats }) => ({ user, stats }))),
  }
}

interface StatsRow {
  user: UserRow
  stats: {
    entries: number | null
    lastEntryOn: string | null
    lastActiveAt: Date | string | null
  } | null
}

/** Wiersze listy: konto + liczniki wpisów i najnowsza subskrypcja (jedno zapytanie na stronę). */
export async function describe(rows: ReadonlyArray<StatsRow>) {
  const ids = rows.map((r) => r.user.id)
  const subs = ids.length
    ? await db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.userId, ids))
        .orderBy(desc(subscriptions.updatedAt))
    : []
  return rows.map(({ user: u, stats }) => {
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
      twoFactor: u.totpEnabledAt !== null,
      isOwner: isOwner(u),
      disabledAt: iso(u.disabledAt),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: iso(u.lastLoginAt),
      lastActiveAt: stats?.lastActiveAt
        ? new Date(stats.lastActiveAt).toISOString()
        : null,
      entries: Number(stats?.entries ?? 0),
      lastEntryOn: stats?.lastEntryOn ?? null,
      subscription: sub
        ? {
            status: sub.status,
            plan: sub.plan,
            active: ACTIVE_SUBSCRIPTION.includes(sub.status),
            currentPeriodEnd: iso(sub.currentPeriodEnd),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }
        : null,
    }
  })
}

/** Jedno konto w tym samym kształcie co wiersz listy. */
export async function describeOne(user: UserRow) {
  const [stats] = await db
    .select({
      entries: count(),
      lastEntryOn: max(timeEntries.workDate),
      lastActiveAt: max(timeEntries.createdAt),
    })
    .from(timeEntries)
    .where(eq(timeEntries.userId, user.id))
  const [row] = await describe([{ user, stats: stats ?? null }])
  return row!
}
