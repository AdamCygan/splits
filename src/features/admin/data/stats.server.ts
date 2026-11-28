import { and, count, countDistinct, eq, gte, inArray, sql } from 'drizzle-orm'

import { PAYMENT_PROBLEM_STATUSES } from '#/features/admin/domain/admin'

import { database } from '#/server/db/client'

import { payments, subscriptions, timeEntries, users } from '#/server/db/schema'

import { ACTIVE_SUBSCRIPTION, DAY } from './shared.server'
import { monthlyRecurring } from '../domain/admin'

export async function getStats() {
  const since = (days: number) => new Date(Date.now() - days * DAY)
  const real = eq(users.isDemo, false)
  const activeSince = (days: number) =>
    database
      .select({ count: countDistinct(timeEntries.userId) })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .where(and(real, gte(timeEntries.createdAt, since(days))))
  const net = sql`${payments.amount} - ${payments.amountRefunded}`
  const [
    [totals],
    demo,
    [active7],
    [active30],
    [subscriptionStats],
    [problems],
    revenue,
    signups,
    [billing],
  ] = await Promise.all([
    database
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
    database.$count(users, eq(users.isDemo, true)),
    activeSince(7),
    activeSince(30),
    database
      .select({ active: count() })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ACTIVE_SUBSCRIPTION)),
    database
      .select({ count: countDistinct(subscriptions.userId) })
      .from(subscriptions)
      .where(inArray(subscriptions.status, [...PAYMENT_PROBLEM_STATUSES])),
    database
      .select({
        currency: payments.currency,
        last30: sql<number>`coalesce(sum(${net}) filter (where ${payments.paidAt} >= ${since(30)}), 0)::int`,
        last365: sql<number>`coalesce(sum(${net}) filter (where ${payments.paidAt} >= ${since(365)}), 0)::int`,
        refunded365: sql<number>`coalesce(sum(${payments.amountRefunded}) filter (where ${payments.paidAt} >= ${since(365)}), 0)::int`,
      })
      .from(payments)
      .groupBy(payments.currency)
      .orderBy(payments.currency),
    database
      .select({
        day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(users)
      .where(and(real, gte(users.createdAt, since(13))))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    // Pro płacone teraz (aktywne i w okresie próbnym), z podziałem na okres i rezygnacje.
    database
      .select({
        monthly: sql<number>`count(*) filter (where ${subscriptions.interval} = 'month')::int`,
        yearly: sql<number>`count(*) filter (where ${subscriptions.interval} is distinct from 'month')::int`,
        cancelling: sql<number>`count(*) filter (where ${subscriptions.cancelAtPeriodEnd})::int`,
      })
      .from(subscriptions)
      .where(inArray(subscriptions.status, ['active', 'trialing'])),
  ])
  return {
    ...totals!,
    demo,
    active7: active7?.count ?? 0,
    active30: active30?.count ?? 0,
    activeSubscriptions: subscriptionStats?.active ?? 0,
    paymentProblems: problems?.count ?? 0,
    revenue,
    signups,
    subscriptions: {
      monthly: billing?.monthly ?? 0,
      yearly: billing?.yearly ?? 0,
      cancelling: billing?.cancelling ?? 0,
    },
    /** Miesięczny przychód z aktywnych subskrypcji Pro (centy USD, z VAT, bez rabatów). */
    mrr: monthlyRecurring(billing?.monthly ?? 0, billing?.yearly ?? 0),
  }
}
