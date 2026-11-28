import { Panel } from '#/components/ui/panel'
import { taskDayTimeline } from '#/features/tasks/domain/task-insights'
import { useFormat, useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import { cn } from '#/lib/utils'
import type { TaskViewModel } from '../../controllers/use-task'

export interface TaskTimelineProps {
  viewModel: TaskViewModel
}

/**
 * Oś dnia: sesje zadania w kolorze rodzaju, inna praca na szaro, luki widać jako puste
 * miejsca. Zakres osi: od najwcześniejszego do najpóźniejszego wpisu z godzinami tego dnia.
 */
export function TaskTimeline({ viewModel }: TaskTimelineProps) {
  const messages = useMessages(taskViewMessages).timeline
  const format = useFormat()
  if (!viewModel.insights) return null
  return (
    <Panel title={messages.title} lead={messages.lead}>
      <ol className="space-y-4">
        {viewModel.insights.days.map((day) => {
          const line = taskDayTimeline(
            day.date,
            viewModel.sessions,
            viewModel.sameDays,
          )
          return (
            <li key={day.date}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{format.day(day.date)}</span>
                <span className="text-ink-soft tabular-nums">
                  {format.plural(messages.sessions, day.sessions)},{' '}
                  <span className="font-semibold text-ink">
                    {format.minutes(day.minutes)}
                  </span>
                </span>
              </p>
              {line.segments.length > 0 && (
                <>
                  <div className="relative mt-1.5 h-7 overflow-hidden rounded-md bg-muted">
                    {line.segments.map((taskDaySegment) => {
                      const entry = taskDaySegment.entry
                      const label = taskDaySegment.own
                        ? fmt(messages.session, {
                            name: entry.title,
                            from: format.time(taskDaySegment.start),
                            to: format.time(taskDaySegment.end),
                            time: format.minutes(entry.durationMinutes),
                          })
                        : fmt(messages.other, {
                            name: `${viewModel.typeOf(entry.taskTypeId)?.name ?? ''} ${entry.title}`.trim(),
                            time: format.minutes(entry.durationMinutes),
                          })
                      const { left, width } = line.place(taskDaySegment)
                      return (
                        <span
                          key={entry.id}
                          title={label}
                          className={cn(
                            'absolute inset-y-0 border-x border-surface',
                            taskDaySegment.own ? 'z-10' : 'bg-ink-soft/35',
                          )}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: taskDaySegment.own
                              ? viewModel.color
                              : undefined,
                          }}
                        >
                          <span className="sr-only">{label}</span>
                        </span>
                      )
                    })}
                  </div>
                  <p
                    aria-hidden
                    className="mt-1 flex justify-between text-xs text-ink-soft tabular-nums"
                  >
                    <span>{format.time(line.from)}</span>
                    <span>{format.time(line.to)}</span>
                  </p>
                </>
              )}
              {line.untimedMinutes > 0 && (
                <p className="mt-1 text-xs text-ink-soft">
                  {fmt(messages.untimed, {
                    time: format.minutes(line.untimedMinutes),
                  })}
                </p>
              )}
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}
