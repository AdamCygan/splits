import { StatGrid, StatTile } from '#/components/ui/stats'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { reportsMessages } from '#/i18n/messages/reports'
import type { ReportsViewModel } from '../../controllers/use-reports'

export interface ReportStatsProps {
  vm: ReportsViewModel
}

/** Liczby okresu: czas (z nadgodzinami i przedłużeniami), SP, zadania, czas na SP, estymaty. */
export function ReportStats({ vm }: ReportStatsProps) {
  const t = useMessages(reportsMessages)
  const format = useFormat()
  const { totals } = vm
  const estimated = totals.estimated
  const diff = estimated.actualMinutes - estimated.estimateMinutes
  const estimateDiff = format.delta(diff, t.stats)
  const timeHint =
    [
      totals.overtimeMinutes > 0
        ? fmt(t.stats.overtime, {
            time: format.minutes(totals.overtimeMinutes),
          })
        : null,
      totals.extensionMinutes > 0
        ? fmt(t.stats.extension, {
            time: format.minutes(totals.extensionMinutes),
          })
        : null,
    ]
      .filter(Boolean)
      .join('; ') || undefined
  return (
    <StatGrid cols={estimated.tasks > 0 ? 5 : 4} className="mb-6">
      <StatTile
        label={t.stats.time}
        value={format.minutes(totals.minutes)}
        hint={timeHint}
      />
      <StatTile label={t.stats.sp} value={format.sp(totals.storyPoints)} />
      <StatTile label={t.stats.tasks} value={format.number(totals.tasks, 0)} />
      <StatTile
        label={t.stats.perSp}
        value={
          totals.minutesPerSp === null
            ? t.stats.none
            : format.minutes(totals.minutesPerSp)
        }
        hint={t.stats.perSpHint}
      />
      {estimated.tasks > 0 && (
        <StatTile
          className="col-span-2 lg:col-span-1"
          label={t.stats.estimate}
          value={fmt(t.stats.estimateValue, {
            actual: format.minutes(estimated.actualMinutes),
            estimate: format.minutes(estimated.estimateMinutes),
          })}
          hint={format
            .plural(t.stats.estimateHint, estimated.tasks)
            .replace('{diff}', estimateDiff)}
        />
      )}
    </StatGrid>
  )
}
