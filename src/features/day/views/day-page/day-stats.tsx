import { StatGrid, StatTile } from '#/components/ui/stats'
import { percentOf } from '#/shared/domain/numbers'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { dayViewMessages } from '#/i18n/messages/day-view'
import type { DayViewModel } from '../../controllers/use-day'

export interface DayStatsProps {
  vm: DayViewModel
}

/** Sumy dnia: praca (wobec celu), skupienie, spotkania i przerwy. */
export function DayStats({ vm }: DayStatsProps) {
  const t = useMessages(dayViewMessages).stats
  const format = useFormat()
  const { summary, target } = vm
  const joined = (parts: Array<string | null>) =>
    parts.filter(Boolean).join('; ') || undefined
  return (
    <StatGrid className="mb-6">
      <StatTile
        label={t.worked}
        value={format.minutes(summary.minutes)}
        hint={joined([
          target > 0
            ? fmt(t.target, {
                percent: percentOf(summary.minutes, target),
                target: format.minutes(target),
              })
            : null,
          summary.overtimeMinutes > 0
            ? fmt(t.overtime, { time: format.minutes(summary.overtimeMinutes) })
            : null,
        ])}
      />
      <StatTile
        label={t.focus}
        value={format.minutes(summary.focusMinutes)}
        hint={joined([
          summary.longestFocus > 0
            ? fmt(t.longest, { time: format.minutes(summary.longestFocus) })
            : null,
          summary.switches > 0
            ? format.plural(t.switches, summary.switches)
            : null,
        ])}
      />
      <StatTile
        label={t.meetings}
        value={format.minutes(summary.meetingMinutes)}
        hint={format.plural(t.meetingCount, summary.meetings)}
      />
      <StatTile
        label={t.breaks}
        value={format.minutes(summary.breakMinutes)}
        hint={
          summary.breaks === 0
            ? t.noBreaks
            : format.plural(t.breakCount, summary.breaks)
        }
      />
    </StatGrid>
  )
}
