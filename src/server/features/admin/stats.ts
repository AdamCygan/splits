import { and, count, countDistinct, eq, gte, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { PAYMENT_PROBLEM_STATUSES } from '#/domain/admin'
import { db } from '../../db/client'
import { payments, subscriptions, timeEntries, users } from '../../db/schema'
import type { AppEnv } from '../../http/context'
import { ACTIVE_SUBSCRIPTION, DAY } from './shared'

/**
 * Liczby na górze panelu. Aktywni = konta, które dodały wpis czasu w okresie (a nie tylko
 * się zalogowały). Przychód = faktycznie zapłacone kwoty minus zwroty (tabela payments,
 * z webhooków Stripe), osobno dla każdej waluty.
 */
export const statsRoutes = new Hono<AppEnv>().get('/stats', async (c) => {
  const since = (days: number) => new Date(Date.now() - days * DAY)
  const real = eq(users.isDemo, false)
  const activeSince = (days: number) =>
    db
      .select({ n: countDistinct(timeEntries.userId) })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .where(and(real, gte(timeEntries.createdAt, since(days))))
  const net = sql`${payments.amount} - ${payments.amountRefunded}`
  const [
    [totals],
    demo,
    [active7],
    [active30],
    [subs],
    [problems],
    revenue,
    signups,
  ] = await Promise.all([
    db
      .select({
        users: count(),
        new7: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(7)})::int`,
        new30: sql<number>`count(*) filter (where ${users.createdAt} >= ${since(30)})::int`,
        free: sql<number>`count(*) filter (where ${users.plan} = 'free')::int`,
        pro: sql<number>`count(*) filter (where ${users.plan} = 'pro')::int`,
        lifetime: sql<number>`count(*) filter (where ${users.plan} = 'lifetime')::int`,
        blocked: sql<number>`count(*) filter (where ${users.disabledAt} is not null)::int`,
      })
      .from(users)
      .where(real),
    db.$count(users, eq(users.isDemo, true)),
    activeSince(7),
    activeSince(30),
    db
      .select({ active: count() })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ACTIVE_SUBSCRIPTION)),
    db
      .select({ n: countDistinct(subscriptions.userId) })
      .from(subscriptions)
      .where(inArray(subscriptions.status, [...PAYMENT_PROBLEM_STATUSES])),
    db
      .select({
        currency: payments.currency,
        last30: sql<number>`coalesce(sum(${net}) filter (where ${payments.paidAt} >= ${since(30)}), 0)::int`,
        last365: sql<number>`coalesce(sum(${net}) filter (where ${payments.paidAt} >= ${since(365)}), 0)::int`,
        refunded365: sql<number>`coalesce(sum(${payments.amountRefunded}) filter (where ${payments.paidAt} >= ${since(365)}), 0)::int`,
      })
      .from(payments)
      .groupBy(payments.currency)
      .orderBy(payments.currency),
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
    active7: active7?.n ?? 0,
    active30: active30?.n ?? 0,
    activeSubscriptions: subs?.active ?? 0,
    paymentProblems: problems?.n ?? 0,
    revenue,
    signups,
  })
})
