import { Link } from '@tanstack/react-router'
import { StatGrid, StatTile } from '#/components/ui/stats'
import type { AdminStats } from '#/data/types'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'

export interface StatsPanelProps {
  stats: AdminStats | undefined
}

/** Liczby na górze: konta, aktywni (wg wpisów), płatne plany, przychód i problemy z płatnością. */
export function StatsPanel({ stats }: StatsPanelProps) {
  const t = useMessages(adminMessages).stats
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
      ? stats.revenue.map((r) => format.money(r[key], r.currency)).join(' + ')
      : t.noRevenue
  const refunded = stats.revenue
    .filter((r) => r.refunded365 > 0)
    .map((r) => format.money(r.refunded365, r.currency))
    .join(' + ')
  return (
    <section aria-label={t.label} className="mb-6">
      <StatGrid cols={4}>
        <StatTile
          label={t.users}
          value={format.number(stats.users, 0)}
          hint={fmt(t.newHint, { n: stats.new30 })}
        />
        <StatTile label={t.new7} value={format.number(stats.new7, 0)} />
        <StatTile
          label={t.active7}
          value={format.number(stats.active7, 0)}
          hint={fmt(t.activeHint, { n: stats.active30 })}
        />
        <StatTile
          label={t.paid}
          value={format.number(stats.pro + stats.lifetime, 0)}
          hint={fmt(t.paidHint, { n: stats.activeSubscriptions })}
        />
        <StatTile label={t.revenue30} value={money('last30')} />
        <StatTile
          label={t.revenue365}
          value={money('last365')}
          hint={refunded ? fmt(t.revenueHint, { refunded }) : undefined}
        />
        <StatTile
          label={t.problems}
          value={format.number(stats.paymentProblems, 0)}
          warn={stats.paymentProblems > 0}
        >
          {stats.paymentProblems > 0 && (
            <Link
              to="/app/admin"
              search={{ payment: 'problem' }}
              className="text-sm font-medium underline underline-offset-4"
            >
              {t.problemsLink}
            </Link>
          )}
        </StatTile>
        <StatTile label={t.demo} value={format.number(stats.demo, 0)} />
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
  const t = useMessages(adminMessages).stats
  const { locale } = useI18n()
  const days = Array.from({ length: 14 }, (_, i) =>
    new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10),
  )
  const counts = days.map((day) => rows.find((r) => r.day === day)?.count ?? 0)
  const peak = Math.max(1, ...counts)
  const label = (day: string, n: number) =>
    fmt(t.signupsDay, {
      date: formatDate(locale, day, { day: 'numeric', month: 'short' }),
      n,
    })
  return (
    <figure className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 sm:px-5">
      <figcaption className="text-sm text-ink-soft">{t.signups}</figcaption>
      <ol className="mt-2 flex h-12 items-end gap-1">
        {days.map((day, i) => (
          <li
            key={day}
            title={label(day, counts[i]!)}
            className="bar-rise flex-1 rounded-sm bg-wt-task"
            style={{
              height: `${Math.max(6, (counts[i]! / peak) * 100)}%`,
              opacity: counts[i] ? 1 : 0.18,
            }}
          >
            <span className="sr-only">{label(day, counts[i]!)}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
