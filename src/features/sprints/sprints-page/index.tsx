import { Link } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { ColumnChart } from '#/features/reports/charts'
import { SectionHeader } from '#/features/settings/components/ui'
import { useFormat, useMessages } from '#/i18n/context'
import { panelMessages } from '#/i18n/messages/panel'
import { reportsMessages } from '#/i18n/messages/reports'
import { CurrentSprint } from './current-sprint'
import { SprintHistory } from './sprint-history'
import { useSprintsViewModel } from './use-sprints'
import type { SprintsViewModel } from './use-sprints'

/**
 * Strona Sprinty (widok w MVVM): bieżący sprint, trend i historia.
 * Stan i dane: `useSprintsViewModel`; obliczenia: domain/sprints i domain/sprint-stats.
 */
export function SprintsPage() {
  const t = useMessages(panelMessages).sprints
  const vm = useSprintsViewModel()
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader title={t.title} lead={t.lead} />
        <Link
          to="/app/settings/sprints"
          className={buttonVariants({ variant: 'outline' })}
        >
          <Settings2 aria-hidden />
          {t.manage}
        </Link>
      </div>

      {vm.clamped && (
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {t.freeNote}
          <Link
            to="/app/settings/plan"
            className="font-semibold underline underline-offset-4"
          >
            {t.upgrade}
          </Link>
        </p>
      )}

      <CurrentSprint vm={vm} />
      <SprintTrend vm={vm} />
      <SprintHistory vm={vm} />
    </div>
  )
}

interface SprintTrendProps {
  vm: SprintsViewModel
}

/** Trend sprint po sprincie: SP i czas na SP (dwie skale, więc dwa wykresy). */
function SprintTrend({ vm }: SprintTrendProps) {
  const charts = useMessages(reportsMessages).charts
  const format = useFormat()
  if (vm.stats.length < 2) return null
  const oldestFirst = [...vm.stats].reverse()
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <ColumnChart
        title={charts.sprints.sp}
        lead={charts.sprints.spLead}
        items={oldestFirst.map((x) => ({
          key: x.sprint.id,
          label: x.sprint.name,
          value: x.storyPoints,
          display: format.number(x.storyPoints),
        }))}
      />
      <ColumnChart
        title={charts.sprints.perSp}
        lead={charts.sprints.perSpLead}
        color="var(--wt-pair)"
        items={oldestFirst.map((x) => ({
          key: x.sprint.id,
          label: x.sprint.name,
          value: x.minutesPerSp ?? 0,
          display:
            x.minutesPerSp === null ? '–' : format.minutes(x.minutesPerSp),
        }))}
      />
    </div>
  )
}
