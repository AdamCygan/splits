import { Link } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { ColumnChart } from '#/features/reports/views/charts'
import { SectionHeader } from '#/features/settings/views/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { panelMessages } from '#/i18n/messages/panel'
import { reportsMessages } from '#/i18n/messages/reports'
import { CurrentSprint } from './current-sprint'
import { SprintHistory } from './sprint-history'
import { useSprintsViewModel } from '../../controllers/use-sprints'
import type { SprintsViewModel } from '../../controllers/use-sprints'

/**
 * Strona Sprinty (widok w MVVM): bieżący sprint, trend i historia.
 * Stan i dane: `useSprintsViewModel`; obliczenia: domain/sprints i domain/sprint-stats.
 */
export function SprintsPage() {
  const messages = useMessages(panelMessages).sprints
  const viewModel = useSprintsViewModel()
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-x-4">
        <SectionHeader title={messages.title} lead={messages.lead} />
        {/* mb-6: gdy przycisk zawinie się pod nagłówek (telefon), nie przykleja się do karty. */}
        <Link
          to="/app/settings/sprints"
          className={buttonVariants({ variant: 'outline', className: 'mb-6' })}
        >
          <Settings2 aria-hidden />
          {messages.manage}
        </Link>
      </div>

      {viewModel.clamped && (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {messages.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold underline underline-offset-4"
          >
            {messages.upgrade}
          </Link>
        </p>
      )}

      <CurrentSprint viewModel={viewModel} />
      <SprintTrend viewModel={viewModel} />
      <SprintHistory viewModel={viewModel} />
    </div>
  )
}

interface SprintTrendProps {
  viewModel: SprintsViewModel
}

/** Trend sprint po sprincie: SP i czas na SP (dwie skale, więc dwa wykresy). */
function SprintTrend({ viewModel }: SprintTrendProps) {
  const charts = useMessages(reportsMessages).charts
  const format = useFormat()
  const hasTooFewSprints = viewModel.stats.length < 2
  if (hasTooFewSprints) return null
  const oldestFirst = [...viewModel.stats].reverse()
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <ColumnChart
        title={charts.sprints.sp}
        lead={charts.sprints.spLead}
        items={oldestFirst.map((sprintStats) => ({
          key: sprintStats.sprint.id,
          label: sprintStats.sprint.name,
          value: sprintStats.storyPoints,
          display: format.number(sprintStats.storyPoints),
        }))}
      />
      <ColumnChart
        title={charts.sprints.perSp}
        lead={charts.sprints.perSpLead}
        color="var(--wt-pair)"
        items={oldestFirst.map((sprintStats) => ({
          key: sprintStats.sprint.id,
          label: sprintStats.sprint.name,
          value: sprintStats.minutesPerSp ?? 0,
          display:
            sprintStats.minutesPerSp === null
              ? '–'
              : format.minutes(sprintStats.minutesPerSp),
        }))}
      />
    </div>
  )
}
