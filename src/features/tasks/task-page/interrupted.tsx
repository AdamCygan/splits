import { ColorDot } from '#/components/ui/controls'
import { Panel } from '#/components/ui/panel'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { taskViewMessages } from '#/i18n/messages/task-view'
import type { TaskViewModel } from './use-task'

/** Co wpisało się między sesje: zbiorczo wg zadania, a pod spodem każda luka po kolei. */
export function Interrupted({ vm }: { vm: TaskViewModel }) {
  const t = useMessages(taskViewMessages).interrupted
  const format = useFormat()
  const { locale } = useI18n()
  const { insights } = vm
  if (!insights) return null
  return (
    <Panel title={t.title} lead={t.lead}>
      {insights.interruptedBy.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {insights.interruptedBy.map((x) => {
            const kind = vm.typeOf(x.taskTypeId)
            return (
              <li
                key={`${x.taskTypeId}|${x.title}`}
                className="flex items-center gap-3 py-2.5"
              >
                <ColorDot color={kind?.color ?? 'var(--wt-custom)'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{x.title}</span>
                  <span className="block text-xs text-ink-soft">
                    {kind?.name}, {format.plural(t.times, x.times)}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {format.minutes(x.minutes)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {insights.gaps.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t.gaps} ({insights.gaps.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {insights.gaps.map((g) => (
              <li key={`${g.date}-${g.from}`}>
                <span className="tabular-nums">
                  {fmt(t.gapLine, {
                    date: formatDate(locale, g.date, {
                      day: 'numeric',
                      month: 'short',
                    }),
                    from: format.time(g.from),
                    to: format.time(g.to),
                    time: format.minutes(g.minutes),
                  })}
                </span>
                <span className="text-ink-soft">
                  {': '}
                  {g.between.length
                    ? g.between.map((b) => b.title).join(', ')
                    : t.nothing}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  )
}
