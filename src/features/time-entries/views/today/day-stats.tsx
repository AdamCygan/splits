import { ProgressBar } from '#/components/ui/progress-bar'
import { StatGrid, StatTile } from '#/components/ui/stats'
import { useFormat } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { BreakTile } from '../breaks'
import type { TodayViewModel } from '../../controllers/use-today'

export interface DayStatsProps {
  viewModel: TodayViewModel
}

/** Liczby dnia: czas względem celu (z paskiem), story pointy, wpisy i przerwy. */
export function DayStats({ viewModel }: DayStatsProps) {
  const { t: messages, totals } = viewModel
  const format = useFormat()
  const hasTarget = totals.targetMinutes > 0
  return (
    <StatGrid className="mb-6">
      <StatTile
        label={messages.summary.logged}
        value={
          hasTarget
            ? fmt(messages.summary.ofTarget, {
                time: format.minutes(totals.minutes),
                target: format.minutes(totals.targetMinutes),
              })
            : format.minutes(totals.minutes)
        }
      >
        {hasTarget && <ProgressBar value={totals.progress} className="mt-2" />}
      </StatTile>
      <StatTile
        label={messages.summary.points}
        value={format.number(totals.storyPoints)}
      />
      <StatTile
        label={messages.summary.entries}
        value={String(totals.entries)}
      />
      <BreakTile date={viewModel.workDate} />
    </StatGrid>
  )
}
