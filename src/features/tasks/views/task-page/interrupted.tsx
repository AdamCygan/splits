import { ColorDot } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from '../../controllers/use-task'

export interface InterruptedProps {
  viewModel: TaskViewModel
}

/** Co wpisało się między sesje: zbiorczo wg zadania, a pod spodem każda luka po kolei. */
export function Interrupted({ viewModel }: InterruptedProps) {
  const messages = useMessages(taskViewMessages).interrupted
  const format = useFormat()
  const { locale } = useI18n()
  const { insights } = viewModel
  if (!insights) return null
  return (
    <Panel title={messages.title} lead={messages.lead}>
      {insights.interruptedBy.length === 0 ? (
        <p className="text-sm text-ink-soft">{messages.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {insights.interruptedBy.map((interrupter) => {
            const kind = viewModel.typeOf(interrupter.taskTypeId)
            return (
              <li
                key={`${interrupter.taskTypeId}|${interrupter.title}`}
                className="flex items-center gap-3 py-2.5"
              >
                <ColorDot color={kind?.color ?? 'var(--wt-custom)'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {interrupter.title}
                  </span>
                  <span className="block text-xs text-ink-soft">
                    {kind?.name},{' '}
                    {format.plural(messages.times, interrupter.times)}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {format.minutes(interrupter.minutes)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {insights.gaps.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">
            {messages.gaps} ({insights.gaps.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {insights.gaps.map((taskGap) => (
              <li key={`${taskGap.date}-${taskGap.from}`}>
                <span className="tabular-nums">
                  {fmt(messages.gapLine, {
                    date: formatDate(locale, taskGap.date, {
                      day: 'numeric',
                      month: 'short',
                    }),
                    from: format.time(taskGap.from),
                    to: format.time(taskGap.to),
                    time: format.minutes(taskGap.minutes),
                  })}
                </span>
                <span className="text-ink-soft">
                  {': '}
                  {taskGap.between.length
                    ? taskGap.between
                        .map((interruption) => interruption.title)
                        .join(', ')
                    : messages.nothing}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}
