import { StatGrid, StatTile } from '#/components/ui/stats'
import { percentOf } from '#/shared/domain/numbers'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import type { DayViewModel } from '../../controllers/use-day'

export interface DayStatsProps {
  viewModel: DayViewModel
}

/** Sumy dnia: praca (wobec celu), skupienie, spotkania i przerwy. */
export function DayStats({ viewModel }: DayStatsProps) {
  const messages = useMessages(dayViewMessages).stats
  const format = useFormat()
  const { summary, target } = viewModel
  const joined = (parts: Array<string | null>) =>
    parts.filter(Boolean).join('; ') || undefined
  return (
    <StatGrid className="mb-6">
      <StatTile
        label={messages.worked}
        value={format.minutes(summary.minutes)}
        hint={joined([
          target > 0
            ? fmt(messages.target, {
                percent: percentOf(summary.minutes, target),
                target: format.minutes(target),
              })
            : null,
          summary.overtimeMinutes > 0
            ? fmt(messages.overtime, {
                time: format.minutes(summary.overtimeMinutes),
              })
            : null,
        ])}
      />
      <StatTile
        label={messages.focus}
        value={format.minutes(summary.focusMinutes)}
        hint={joined([
          summary.longestFocus > 0
            ? fmt(messages.longest, {
                time: format.minutes(summary.longestFocus),
              })
            : null,
          summary.switches > 0
            ? format.plural(messages.switches, summary.switches)
            : null,
        ])}
      />
      <StatTile
        label={messages.meetings}
        value={format.minutes(summary.meetingMinutes)}
        hint={format.plural(messages.meetingCount, summary.meetings)}
      />
      <StatTile
        label={messages.breaks}
        value={format.minutes(summary.breakMinutes)}
        hint={
          summary.breaks === 0
            ? messages.noBreaks
            : format.plural(messages.breakCount, summary.breaks)
        }
      />
    </StatGrid>
  )
}
