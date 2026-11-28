import { Link } from '@tanstack/react-router'
import { StatGrid, StatTile } from '#/components/ui/stats'
import type { AdminStats } from '#/features/admin/data/dto'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { conversionRate } from '#/features/admin/domain/admin'

export interface StatsPanelProps {
  stats: AdminStats | undefined
}

/** Liczby na górze: konta, aktywni (wg wpisów), płatne plany, przychód i problemy z płatnością. */
export function StatsPanel({ stats }: StatsPanelProps) {
  const messages = useMessages(adminMessages).stats
  const format = useFormat()
  if (!stats)
    return (
      <div
        aria-hidden
        className="mb-6 h-48 animate-pulse rounded-2xl bg-muted"
      />
    )
  const money = (key: 'last30' | 'last365') =>
    stats.revenue.length
      ? stats.revenue
          .map((revenue) => format.money(revenue[key], revenue.currency))
          .join(' + ')
      : messages.noRevenue
  const conversion = conversionRate(stats.pro + stats.lifetime, stats.users)
  const refunded = stats.revenue
    .filter((revenue) => revenue.refunded365 > 0)
    .map((revenue) => format.money(revenue.refunded365, revenue.currency))
    .join(' + ')
  return (
    <section aria-label={messages.label} className="mb-6">
      <StatGrid cols={4}>
        <StatTile
          label={messages.users}
          value={format.number(stats.users, 0)}
          hint={fmt(messages.newHint, { n: stats.new30 })}
        />
        <StatTile label={messages.new7} value={format.number(stats.new7, 0)} />
        <StatTile
          label={messages.active7}
          value={format.number(stats.active7, 0)}
          hint={fmt(messages.activeHint, { n: stats.active30 })}
        />
        <StatTile
          label={messages.paid}
          value={format.number(stats.pro + stats.lifetime, 0)}
          hint={fmt(messages.paidHint, { n: stats.activeSubscriptions })}
        />
        <StatTile label={messages.revenue30} value={money('last30')} />
        <StatTile
          label={messages.revenue365}
          value={money('last365')}
          hint={refunded ? fmt(messages.revenueHint, { refunded }) : undefined}
        />
        <StatTile
          label={messages.problems}
          value={format.number(stats.paymentProblems, 0)}
          warn={stats.paymentProblems > 0}
        >
          {stats.paymentProblems > 0 && (
            <Link
              to="/app/admin"
              search={{ payment: 'problem' }}
              className="text-sm font-medium underline underline-offset-4"
            >
              {messages.problemsLink}
            </Link>
          )}
        </StatTile>
        <StatTile
          label={messages.mrr}
          value={format.money(stats.mrr, 'usd')}
          hint={fmt(messages.mrrHint, {
            monthly: stats.subscriptions.monthly,
            yearly: stats.subscriptions.yearly,
          })}
        />
        <StatTile
          label={messages.conversion}
          value={`${format.number(conversion, 1)}%`}
          hint={fmt(messages.conversionHint, {
            paid: stats.pro + stats.lifetime,
            users: stats.users,
          })}
        />
        <StatTile
          label={messages.cancelling}
          value={format.number(stats.subscriptions.cancelling, 0)}
          hint={messages.cancellingHint}
          warn={stats.subscriptions.cancelling > 0}
        />
        <StatTile label={messages.demo} value={format.number(stats.demo, 0)} />
      </StatGrid>
      <Signups rows={stats.signups} />
    </section>
  )
}

interface SignupsProps {
  rows: AdminStats['signups']
}

/** Rejestracje z 14 dni jako małe słupki; dokładne liczby w podpisach i w title. */
function Signups({ rows }: SignupsProps) {
  const messages = useMessages(adminMessages).stats
  const { locale } = useI18n()
  const days = Array.from({ length: 14 }, (_unused, index) =>
    new Date(Date.now() - (13 - index) * 86_400_000).toISOString().slice(0, 10),
  )
  const counts = days.map(
    (day) => rows.find((row) => row.day === day)?.count ?? 0,
  )
  const peak = Math.max(1, ...counts)
  const label = (day: string, count: number) =>
    fmt(messages.signupsDay, {
      date: formatDate(locale, day, { day: 'numeric', month: 'short' }),
      n: count,
    })
  return (
    <figure className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 sm:px-5">
      <figcaption className="text-sm text-ink-soft">
        {messages.signups}
      </figcaption>
      <ol className="mt-2 flex h-12 items-end gap-1">
        {days.map((day, index) => (
          <li
            key={day}
            title={label(day, counts[index]!)}
            className="bar-rise flex-1 rounded-sm bg-wt-task"
            style={{
              height: `${Math.max(6, (counts[index]! / peak) * 100)}%`,
              opacity: counts[index] ? 1 : 0.18,
            }}
          >
            <span className="sr-only">{label(day, counts[index]!)}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
