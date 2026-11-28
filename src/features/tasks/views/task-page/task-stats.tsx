import { StatGrid, StatTile } from '#/components/ui/stats'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from '../../controllers/use-task'

export interface TaskStatsProps {
  viewModel: TaskViewModel
}

/** Czas (wobec estymaty albo na SP), sesje, dni i przerwania w pracy nad zadaniem. */
export function TaskStats({ viewModel }: TaskStatsProps) {
  const messages = useMessages(taskViewMessages).stats
  const format = useFormat()
  const { locale } = useI18n()
  const { insights, estimate, sp: storyPoints } = viewModel
  if (!insights) return null
  const dateShort = (isoDate: string) =>
    formatDate(locale, isoDate, { day: 'numeric', month: 'short' })
  return (
    <StatGrid className="mb-8">
      <StatTile
        label={messages.time}
        value={format.minutes(insights.minutes)}
        hint={[
          estimate !== null
            ? fmt(messages.estimate, {
                estimate: format.minutes(estimate),
                diff: format.delta(viewModel.overEstimate, messages),
              })
            : storyPoints
              ? `${format.minutes(Math.round(insights.minutes / storyPoints))} / SP`
              : null,
          insights.overtimeMinutes > 0
            ? fmt(messages.extra, {
                overtime: format.minutes(insights.overtimeMinutes),
              })
            : null,
          insights.extensionMinutes > 0
            ? fmt(messages.extension, {
                time: format.minutes(insights.extensionMinutes),
              })
            : null,
        ]
          .filter(Boolean)
          .join('; ')}
        warn={viewModel.overEstimate > 0}
      />
      <StatTile
        label={messages.sessions}
        value={String(insights.sessions)}
        hint={fmt(messages.average, {
          time: format.minutes(insights.averageSession),
          longest: format.minutes(insights.longestSession),
        })}
      />
      <StatTile
        label={messages.days}
        value={String(insights.days.length)}
        hint={format
          .plural(
            messages.span,
            insights.firstDate === insights.lastDate ? 1 : insights.spanDays,
          )
          .replace('{from}', dateShort(insights.firstDate))
          .replace('{to}', dateShort(insights.lastDate))}
      />
      <StatTile
        label={messages.interruptions}
        value={String(insights.gaps.length)}
        hint={
          insights.minutesPerInterruption === null
            ? messages.none
            : fmt(messages.every, {
                time: format.minutes(insights.minutesPerInterruption),
              })
        }
      />
    </StatGrid>
  )
}
