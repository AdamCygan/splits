import { Link } from '@tanstack/react-router'
import { buttonVariants } from '#/components/ui/button'
import { FREE_LIMITS } from '#/features/billing/plans'
import { TaskDialog } from '#/features/time-entries/components/task-dialog'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import { cn } from '#/lib/utils'
import { EstimateChart, HourHeatmap, TimeChart } from '../charts'
import { ReportFilters } from './report-filters'
import { ReportStats } from './report-stats'
import { TaskTable } from './task-table'
import { TypeBreakdown } from './type-breakdown'
import { useReportsViewModel } from './use-reports'
import type { ReportsViewModel } from './use-reports'

/**
 * Strona Raporty (widok w MVVM): filtry, liczby, wykresy i tabela zadań okresu.
 * Stan i dane: `useReportsViewModel`; obliczenia: domain/report.
 */
export function ReportsPage({ initialSprintId }: { initialSprintId?: string }) {
  const t = useMessages(reportsMessages)
  const vm = useReportsViewModel({ initialSprintId })
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="type-display text-4xl sm:text-5xl">{t.pageTitle}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">{t.lead}</p>
      </header>

      <ReportFilters vm={vm} />
      <FreeLimitNote vm={vm} />
      <ReportStats vm={vm} />

      {vm.pending ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">…</span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-12 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : vm.allRows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
          <p className="text-ink-soft">{t.empty}</p>
          <Link
            to="/app"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            {t.emptyCta}
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="report-charts" className="mb-6">
            <h2 id="report-charts" className="sr-only">
              {t.charts.title}
            </h2>
            {/* Wykres dnia i podział na rodzaje pracy obok siebie, tabela zadań pod spodem na całą szerokość. */}
            <div className="grid items-start gap-6 lg:grid-cols-3">
              <TimeChart
                className="lg:col-span-2"
                entries={vm.chartEntries}
                from={vm.range.from}
                to={vm.range.to}
                types={vm.types}
                onOpen={vm.openBucket}
              />
              <TypeBreakdown vm={vm} />
              <HourHeatmap
                entries={vm.chartEntries}
                className="lg:col-span-2"
              />
              <EstimateChart rows={vm.rows} />
            </div>
          </section>
          <TaskTable vm={vm} />
        </>
      )}
      {vm.editing && <TaskDialog task={vm.editing} onClose={vm.closeEdit} />}
    </div>
  )
}

/** Plan Free: okres sięga dalej niż historia planu, więc pokazujemy tylko ostatnie dni. */
function FreeLimitNote({ vm }: { vm: ReportsViewModel }) {
  const t = useMessages(reportsMessages)
  const { locale } = useI18n()
  if (!vm.clamped || !vm.oldest) return null
  return (
    <p className="mb-6 rounded-xl border border-line bg-muted/50 px-4 py-3 text-sm">
      {fmt(t.freeLimit, {
        days: FREE_LIMITS.historyDays,
        date: formatDate(locale, vm.oldest, { day: 'numeric', month: 'long' }),
      })}{' '}
      <Link
        to="/app/settings/plan"
        className="font-medium underline underline-offset-4"
      >
        {t.upgrade}
      </Link>
    </p>
  )
}
