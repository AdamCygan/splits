import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { Badge } from '#/components/ui/controls'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import { cn } from '#/lib/utils'
import { DayStats } from './day-stats'
import { DayTasks } from './day-tasks'
import { DayTimeline } from './day-timeline'
import { TypeShare } from './type-share'
import { useDayViewModel } from './use-day'

/**
 * Podsumowanie jednego dnia (widok w MVVM), otwierane z wykresu „Czas dzień po dniu”
 * w Raportach: sumy, oś dnia, podział na rodzaje pracy i zadania z notatkami.
 */
export function DayPage({ date }: { date: string }) {
  const t = useMessages(dayViewMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const vm = useDayViewModel(date)
  const { span } = vm.summary
  return (
    <div className="mx-auto max-w-6xl">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t.back}
        </Link>
        <div className="flex gap-2">
          <Link
            to="/app/day"
            search={{ date: vm.previous }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {t.previous}
          </Link>
          {vm.next && (
            <Link
              to="/app/day"
              search={{ date: vm.next }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {t.next}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      </nav>

      <header className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-display text-3xl sm:text-4xl">
            {formatDate(locale, date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h1>
          {(span || vm.dayOff) && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-soft tabular-nums">
              {span &&
                fmt(t.stats.dayFrom, {
                  from: format.time(span.start),
                  to: format.time(span.end),
                })}
              {vm.dayOff && (
                <Badge tone="muted">{t.dayOff[vm.dayOff.kind]}</Badge>
              )}
            </p>
          )}
        </div>
        <Link
          to="/app"
          search={{ date }}
          className={buttonVariants({ variant: 'outline' })}
        >
          <Pencil aria-hidden className="size-4" />
          {t.edit}
        </Link>
      </header>

      {vm.pending ? (
        <div aria-hidden className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : vm.empty ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{t.empty}</p>
          <Link
            to="/app"
            search={{ date }}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {t.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <DayStats vm={vm} />
          <DayTimeline vm={vm} />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <DayTasks vm={vm} />
            <TypeShare vm={vm} />
          </div>
        </>
      )}
    </div>
  )
}
