import { Link } from '@tanstack/react-router'
import { buttonVariants } from '#/components/ui/button'
import { FREE_LIMITS } from '#/features/billing/domain/plans'
import { TaskDialog } from '#/features/time-entries/views/task-dialog'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'
import { EstimateChart, HourHeatmap, TimeChart } from '../charts'
import { ReportFilters } from './report-filters'
import { ReportStats } from './report-stats'
import { TaskTable } from './task-table'
import { TypeBreakdown } from './type-breakdown'
import { useReportsViewModel } from '../../controllers/use-reports'
import type { ReportsViewModel } from '../../controllers/use-reports'

export interface ReportsPageProps {
  initialSprintId?: string
}

/**
 * Strona Raporty (widok w MVVM): filtry, liczby, wykresy i tabela zadań okresu.
 * Stan i dane: `useReportsViewModel`; obliczenia: domain/report.
 */
export function ReportsPage({ initialSprintId }: ReportsPageProps) {
  const messages = useMessages(reportsMessages)
  const viewModel = useReportsViewModel({ initialSprintId })
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="type-display text-4xl sm:text-5xl">
          {messages.pageTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">{messages.lead}</p>
      </header>

      <ReportFilters viewModel={viewModel} />
      <FreeLimitNote viewModel={viewModel} />
      <ReportStats viewModel={viewModel} />

      {viewModel.pending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">…</span>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              aria-hidden
              className="h-12 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : viewModel.allRows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{messages.empty}</p>
          <Link
            to="/app"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {messages.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="report-charts" className="mb-6">
            <h2 id="report-charts" className="sr-only">
              {messages.charts.title}
            </h2>
            {/* Wykres dnia i podział na rodzaje pracy obok siebie, tabela zadań pod spodem na całą szerokość. */}
            <div className="grid items-start gap-6 lg:grid-cols-3">
              <TimeChart
                className="lg:col-span-2"
                entries={viewModel.chartEntries}
                from={viewModel.range.from}
                to={viewModel.range.to}
                types={viewModel.types}
                onOpen={viewModel.openBucket}
              />
              <TypeBreakdown viewModel={viewModel} />
              <HourHeatmap
                entries={viewModel.chartEntries}
                className="lg:col-span-2"
              />
              <EstimateChart rows={viewModel.rows} />
            </div>
          </section>
          <TaskTable viewModel={viewModel} />
        </>
      )}
      {viewModel.editing && (
        <TaskDialog task={viewModel.editing} onClose={viewModel.closeEdit} />
      )}
    </div>
  )
}

interface FreeLimitNoteProps {
  viewModel: ReportsViewModel
}

/** Plan Free: okres sięga dalej niż historia planu, więc pokazujemy tylko ostatnie dni. */
function FreeLimitNote({ viewModel }: FreeLimitNoteProps) {
  const messages = useMessages(reportsMessages)
  const { locale } = useI18n()
  const { oldest } = viewModel
  const hasNoHistoryLimit = !viewModel.clamped || !oldest
  if (hasNoHistoryLimit) return null
  return (
    <p className="mb-6 rounded-xl border border-line bg-muted/50 px-4 py-3 text-sm">
      {fmt(messages.freeLimit, {
        days: FREE_LIMITS.historyDays,
        date: formatDate(locale, oldest, {
          day: 'numeric',
          month: 'long',
        }),
      })}{' '}
      <Link
        to="/app/settings/plan"
        className="font-medium underline underline-offset-4"
      >
        {messages.upgrade}
      </Link>
    </p>
  )
}
