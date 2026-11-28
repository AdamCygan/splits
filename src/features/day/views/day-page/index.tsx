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
import { useDayViewModel } from '../../controllers/use-day'

export interface DayPageProps {
  date: string
}

/**
 * Podsumowanie jednego dnia (widok w MVVM), otwierane z wykresu „Czas dzień po dniu”
 * w Raportach: sumy, oś dnia, podział na rodzaje pracy i zadania z notatkami.
 */
export function DayPage({ date }: DayPageProps) {
  const messages = useMessages(dayViewMessages)
  const format = useFormat()
  const { locale } = useI18n()
  const viewModel = useDayViewModel(date)
  const { span } = viewModel.summary
  return (
    <div className="mx-auto max-w-6xl">
      <nav className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {messages.back}
        </Link>
        <div className="flex gap-2">
          <Link
            to="/app/day"
            search={{ date: viewModel.previous }}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ChevronLeft aria-hidden className="size-4" />
            {messages.previous}
          </Link>
          {viewModel.next && (
            <Link
              to="/app/day"
              search={{ date: viewModel.next }}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {messages.next}
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
          {(span || viewModel.dayOff) && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-soft tabular-nums">
              {span &&
                fmt(messages.stats.dayFrom, {
                  from: format.time(span.start),
                  to: format.time(span.end),
                })}
              {viewModel.dayOff && (
                <Badge tone="muted">
                  {messages.dayOff[viewModel.dayOff.kind]}
                </Badge>
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
          {messages.edit}
        </Link>
      </header>

      {viewModel.pending ? (
        <div aria-hidden className="h-64 animate-pulse rounded-2xl bg-muted" />
      ) : viewModel.empty ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{messages.empty}</p>
          <Link
            to="/app"
            search={{ date }}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {messages.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <DayStats viewModel={viewModel} />
          <DayTimeline viewModel={viewModel} />
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <DayTasks viewModel={viewModel} />
            <TypeShare viewModel={viewModel} />
          </div>
        </>
      )}
    </div>
  )
}
