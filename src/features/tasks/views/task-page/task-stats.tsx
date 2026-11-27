import { StatGrid, StatTile } from '#/components/ui/stats'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from '../../controllers/use-task'

export interface TaskStatsProps {
  vm: TaskViewModel
}

/** Czas (wobec estymaty albo na SP), sesje, dni i przerwania w pracy nad zadaniem. */
export function TaskStats({ vm }: TaskStatsProps) {
  const t = useMessages(taskViewMessages).stats
  const format = useFormat()
  const { locale } = useI18n()
  const { insights, estimate, sp } = vm
  if (!insights) return null
  const dateShort = (d: string) =>
    formatDate(locale, d, { day: 'numeric', month: 'short' })
  return (
    <StatGrid className="mb-8">
      <StatTile
        label={t.time}
        value={format.minutes(insights.minutes)}
        hint={[
          estimate !== null
            ? fmt(t.estimate, {
                estimate: format.minutes(estimate),
                diff: format.delta(vm.overEstimate, t),
              })
            : sp
              ? `${format.minutes(Math.round(insights.minutes / sp))} / SP`
              : null,
          insights.overtimeMinutes > 0
            ? fmt(t.extra, {
                overtime: format.minutes(insights.overtimeMinutes),
              })
            : null,
          insights.extensionMinutes > 0
            ? fmt(t.extension, {
                time: format.minutes(insights.extensionMinutes),
              })
            : null,
        ]
          .filter(Boolean)
          .join('; ')}
        warn={vm.overEstimate > 0}
      />
      <StatTile
        label={t.sessions}
        value={String(insights.sessions)}
        hint={fmt(t.average, {
          time: format.minutes(insights.averageSession),
          longest: format.minutes(insights.longestSession),
        })}
      />
      <StatTile
        label={t.days}
        value={String(insights.days.length)}
        hint={format
          .plural(
            t.span,
            insights.firstDate === insights.lastDate ? 1 : insights.spanDays,
          )
          .replace('{from}', dateShort(insights.firstDate))
          .replace('{to}', dateShort(insights.lastDate))}
      />
      <StatTile
        label={t.interruptions}
        value={String(insights.gaps.length)}
        hint={
          insights.minutesPerInterruption === null
            ? t.none
            : fmt(t.every, {
                time: format.minutes(insights.minutesPerInterruption),
              })
        }
      />
    </StatGrid>
  )
}
